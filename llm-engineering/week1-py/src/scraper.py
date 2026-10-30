# Shared scraping helper for Week 1.
# A Website class (the course's version, requests + BeautifulSoup) plus a
# load_local(path) helper so the labs can run fully OFFLINE against a fixture.

import os

import requests
from bs4 import BeautifulSoup

# Some websites refuse a request that has no User-Agent header, so we send a
# normal browser one (same as the course).
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
}


class Website:
    """A scraped website: its url, title, cleaned body text, and links."""

    def __init__(self, url, html=None):
        """Build from a live URL (html=None) or from pre-fetched HTML.

        Passing `html` lets us parse a local file without any network access.
        """
        self.url = url
        if html is None:
            response = requests.get(url, headers=HEADERS)
            html = response.content
        self.body = html

        soup = BeautifulSoup(self.body, "html.parser")
        self.title = soup.title.string if soup.title else "No title found"
        if soup.body:
            for irrelevant in soup.body(["script", "style", "img", "input"]):
                irrelevant.decompose()
            self.text = soup.body.get_text(separator="\n", strip=True)
        else:
            self.text = ""

        links = [link.get("href") for link in soup.find_all("a")]
        self.links = [link for link in links if link]

    def get_contents(self):
        return f"Webpage Title:\n{self.title}\nWebpage Contents:\n{self.text}\n\n"


def load_local(path):
    """Parse a local HTML file and return a Website (no network required).

    The url is set to a file:// URL so downstream code that joins relative
    links still has a sensible base.
    """
    with open(path, "rb") as f:
        html = f.read()
    url = "file:///" + os.path.abspath(path).replace("\\", "/")
    return Website(url, html=html)
