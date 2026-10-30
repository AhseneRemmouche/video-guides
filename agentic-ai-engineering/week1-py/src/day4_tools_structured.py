"""Day 4 - structured output (Pydantic) AND tool calling, against LOCAL Ollama.

Part A: a Pydantic model describes a structured reply; we ask the model for JSON
        and validate it into the model.
Part B: a simple tool (JSON schema) the model may call. We send a query with the
        tool attached. If the local model emits a tool call we run it; if it does
        NOT (small local models often won't), we FALL BACK to calling the tool
        directly and SAY SO.

Course parallel: lab4 (4_lab4.py) uses structured outputs + tools with paid
frontier models. Here it runs locally and free.
"""

import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv(override=True)

BASE_URL = os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.getenv("OPENAI_API_KEY", "ollama")
MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)


# ---------- Part A: structured output via Pydantic ----------
class CityFact(BaseModel):
    city: str = Field(description="City name")
    country: str = Field(description="Country the city is in")
    population_millions: float = Field(description="Approximate population in millions")
    fun_fact: str = Field(description="One short fun fact")


def structured_demo():
    print("\n--- PART A: STRUCTURED OUTPUT (Pydantic) ---")
    # Small local models follow a concrete example better than a raw JSON schema.
    example = {
        "city": "Tokyo",
        "country": "Japan",
        "population_millions": 14.0,
        "fun_fact": "It has the world's busiest pedestrian crossing.",
    }
    prompt = (
        "Give facts about the city of Paris. "
        "Respond with ONLY a JSON object (no markdown, no code fences) with exactly "
        "these keys: city (string), country (string), population_millions (number), "
        "fun_fact (string). Example of the format:\n"
        f"{json.dumps(example)}"
    )
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150,
        temperature=0.2,
    )
    raw = resp.choices[0].message.content.strip()
    print(f"[raw model output]\n{raw}")
    try:
        start, end = raw.find("{"), raw.rfind("}")
        fact = CityFact.model_validate_json(raw[start : end + 1])
        print(f"\n[parsed Pydantic object] {fact!r}")
        print(f"  -> city={fact.city}, country={fact.country}, pop(M)={fact.population_millions}")
    except Exception as e:
        print(f"\n[note] Could not validate into CityFact ({e}).")


# ---------- Part B: tool calling with direct fallback ----------
def get_weather(city: str):
    """Pretend weather tool (canned data, no network)."""
    canned = {"paris": "18C and cloudy", "london": "14C and rainy"}
    return {"city": city, "weather": canned.get(city.lower(), "unknown")}


weather_tool = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather for a given city.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "The city name"}
            },
            "required": ["city"],
            "additionalProperties": False,
        },
    },
}


def tool_demo():
    print("\n--- PART B: TOOL CALLING ---")
    query = "What is the weather in Paris right now?"
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": query}],
        tools=[weather_tool],
        max_tokens=150,
    )
    choice = resp.choices[0]
    tool_calls = choice.message.tool_calls

    if tool_calls:
        print(f"[local model DID emit a tool call] finish_reason={choice.finish_reason}")
        for tc in tool_calls:
            args = json.loads(tc.function.arguments)
            print(f"  tool={tc.function.name} args={args}")
            result = get_weather(**args)
            print(f"  tool result={result}")
    else:
        print("[local model did NOT emit a tool call -> FALLBACK: calling the tool directly]")
        result = get_weather("Paris")
        print(f"  direct tool result={result}")
        print(f"  (model's plain text reply was: {choice.message.content!r})")


def main():
    print("=" * 60)
    print(f"MODEL: {MODEL}  (local Ollama, no paid key)")
    print("=" * 60)
    structured_demo()
    tool_demo()
    print("\n[DONE]")


if __name__ == "__main__":
    main()
