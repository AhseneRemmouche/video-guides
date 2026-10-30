# Day 1 - Website Summarizer, offline edition.
# Same idea as the course ("Reader's Digest of the internet"), but it summarizes
# a LOCAL HTML fixture via a local Ollama model, so it needs no network and no
# paid API key.

import os

from dotenv import load_dotenv
from openai import OpenAI

from scraper import load_local

load_dotenv(override=True)

BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
MODEL = os.getenv("MODEL", "llama3.2")

# With Ollama the api_key is ignored, but the client still requires one.
client = OpenAI(base_url=BASE_URL, api_key="ollama")

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "..", "fixtures", "sample.html")

system_prompt = (
    "You are an assistant that analyzes the contents of a website and provides a "
    "short summary, ignoring text that might be navigation related. Respond in markdown."
)


def user_prompt_for(website):
    user_prompt = f"You are looking at a website titled {website.title}\n"
    user_prompt += (
        "The contents of this website is as follows; please provide a short "
        "summary of this website in markdown. If it includes news or "
        "announcements, then summarize these too.\n\n"
    )
    user_prompt += website.text
    return user_prompt


def messages_for(website):
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt_for(website)},
    ]


def main():
    website = load_local(FIXTURE)
    print(f"Scraped local fixture: {website.title}")
    print(f"({len(website.text)} chars of body text, {len(website.links)} links)\n")

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages_for(website),
        max_tokens=250,
    )
    print("--- Summary ---")
    print(response.choices[0].message.content)


if __name__ == "__main__":
    main()
