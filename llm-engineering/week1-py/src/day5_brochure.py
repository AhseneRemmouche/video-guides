# Day 5 - The company brochure, offline edition.
# A first taste of an "agentic" multi-step workflow, two LLM calls:
#   1) ask the model which links on the page are relevant, answering in JSON
#   2) ask it to write a short markdown brochure from the page contents
# Runs on the LOCAL fixture via a local Ollama model - no network, no paid key.

import json
import os
from urllib.parse import urljoin

from dotenv import load_dotenv
from openai import OpenAI

from scraper import load_local

load_dotenv(override=True)

BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
MODEL = os.getenv("MODEL", "llama3.2")

client = OpenAI(base_url=BASE_URL, api_key="ollama")

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "..", "fixtures", "sample.html")

# --- Step 1: ask the model which links matter, answering in strict JSON -------
link_system_prompt = """You are provided with a list of links found on a webpage. \
You can decide which of the links would be most relevant to include in a brochure \
about the company, such as an About page or a Careers/Jobs page.
Respond in JSON like this example:
{
    "links": [
        {"type": "about page", "url": "https://full.url/goes/here/about"},
        {"type": "careers page", "url": "https://another.full.url/careers"}
    ]
}
Do not include Terms of Service, Privacy, or email links."""


def get_links_user_prompt(website):
    user_prompt = f"Here is the list of links on the website of {website.url} - "
    user_prompt += (
        "please decide which of these are relevant web links for a brochure about "
        "the company, and respond with the full URL in JSON format. Do not include "
        "Terms of Service, Privacy, or email links.\n"
    )
    user_prompt += "Links (some might be relative links):\n"
    user_prompt += "\n".join(website.links)
    return user_prompt


def get_links(website):
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": link_system_prompt},
            {"role": "user", "content": get_links_user_prompt(website)},
        ],
        response_format={"type": "json_object"},
        max_tokens=300,
    )
    return json.loads(response.choices[0].message.content)


# --- Step 2: write the brochure -----------------------------------------------
brochure_system_prompt = (
    "You are an assistant that analyzes the contents of a company website and "
    "creates a SHORT brochure about the company for prospective customers, "
    "investors and recruits. Respond in markdown. Keep it under 150 words. "
    "Include company culture, customers and careers if you have the information."
)


def main():
    website = load_local(FIXTURE)
    print(f"Landing page: {website.title}")
    print(f"Found {len(website.links)} links on the page.\n")

    # Step 1
    print("--- Step 1: model picks relevant links (JSON) ---")
    links = get_links(website)
    print(json.dumps(links, indent=2))

    # Resolve the chosen links to absolute URLs (offline: we just show them).
    chosen = [urljoin(website.url, item["url"]) for item in links.get("links", [])]
    print("\nResolved chosen URLs:")
    for url in chosen:
        print(f"  {url}")

    # Step 2 - we only have the one local page, so we brief the model on it.
    user_prompt = (
        "You are looking at a company called Acme Robotics.\n"
        "Here are the contents of its landing page; use this to build a short "
        "brochure of the company in markdown.\n\n"
        + website.get_contents()
    )[:4000]

    print("\n--- Step 2: brochure ---")
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": brochure_system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=320,
    )
    print(response.choices[0].message.content)


if __name__ == "__main__":
    main()
