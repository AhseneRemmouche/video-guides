"""Day 3 - multi-LLM 'panel + judge', run against TWO LOCAL Ollama models.

Ask the same question to llama3.2 and dolphin3:8b (both via Ollama's OpenAI
endpoint), then have llama3.2 JUDGE which answer is better.

Course parallel: lab3 (3_lab3.py) sends one question to several paid frontier
models (GPT / Claude / Gemini / DeepSeek / Groq) and uses an LLM judge. Here we
swap in two local models so it runs free.
"""

import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

BASE_URL = os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.getenv("OPENAI_API_KEY", "ollama")
MODEL_1 = os.getenv("OLLAMA_MODEL", "llama3.2")
MODEL_2 = os.getenv("OLLAMA_MODEL_2", "dolphin3:8b")

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)


def ask(model, content, max_tokens=150):
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": content}],
        max_tokens=max_tokens,
        temperature=0.5,
    )
    return resp.choices[0].message.content.strip()


def main():
    question = "In one short paragraph: what is the single most important habit for learning to code, and why?"

    print("=" * 60)
    print("MULTI-LLM PANEL (local Ollama, no paid keys)")
    print(f"QUESTION: {question}")
    print("=" * 60)

    competitors = [MODEL_1, MODEL_2]
    answers = []
    for model in competitors:
        ans = ask(model, question)
        answers.append(ans)
        print(f"\n[{model}]\n{ans}")

    # Build the judge prompt (judged by MODEL_1).
    together = ""
    for i, ans in enumerate(answers, start=1):
        together += f"# Response from competitor {i}\n\n{ans}\n\n"

    judge_prompt = (
        f"You are judging {len(competitors)} answers to this question:\n\n{question}\n\n"
        "Decide which answer is clearer and better argued. "
        'Respond with ONLY JSON in this exact format: {"best": <number>, "reason": "<short reason>"}\n\n'
        f"{together}\n"
        "Respond with only the JSON, no markdown, no code fences."
    )

    print("\n" + "=" * 60)
    print(f"JUDGE ({MODEL_1}) verdict:")
    print("=" * 60)
    verdict = ask(MODEL_1, judge_prompt, max_tokens=150)
    print(verdict)

    # Best-effort parse so we can name the winner explicitly.
    import json
    try:
        start, end = verdict.find("{"), verdict.rfind("}")
        data = json.loads(verdict[start : end + 1])
        best = int(data["best"])
        print(f"\n[WINNER] competitor {best} = {competitors[best - 1]}")
    except Exception as e:
        print(f"\n[note] Could not parse judge JSON ({e}); raw verdict shown above.")

    print("\n[DONE]")


if __name__ == "__main__":
    main()
