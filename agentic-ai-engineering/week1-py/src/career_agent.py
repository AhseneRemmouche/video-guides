"""Career 'digital twin' agent - the Week 1 capstone, against LOCAL Ollama.

A short bio lives in the system prompt. Two tools (JSON schemas) let the agent
record things it can't handle:
  - record_unknown_question : when it can't answer from the bio
  - record_user_details     : when a user leaves an email

The tool-call loop runs against Ollama. pushover() is a STUB that just prints
(no real push notification is sent).

Course parallel: 1_foundations__app.py runs this as a Gradio chat using a paid
GPT model + a REAL Pushover account. Here it is local, free, headless, and the
push is stubbed.
"""

import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

BASE_URL = os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.getenv("OPENAI_API_KEY", "ollama")
MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)

# track which tools fired, for the report
FIRED = []


def pushover(message):
    """STUB: the course sends a real Pushover push here. We just print."""
    print(f"   [pushover STUB] {message}")


def record_user_details(email, name="Name not provided", notes="not provided"):
    FIRED.append("record_user_details")
    pushover(f"Recording interest from {name} with email {email} and notes {notes}")
    return {"recorded": "ok"}


def record_unknown_question(question):
    FIRED.append("record_unknown_question")
    pushover(f"Recording unknown question: {question}")
    return {"recorded": "ok"}


record_user_details_json = {
    "name": "record_user_details",
    "description": "Use this tool to record that a user is interested in being in touch and provided an email address",
    "parameters": {
        "type": "object",
        "properties": {
            "email": {"type": "string", "description": "The email address of this user"},
            "name": {"type": "string", "description": "The user's name, if they provided it"},
            "notes": {"type": "string", "description": "Any additional context worth recording"},
        },
        "required": ["email"],
        "additionalProperties": False,
    },
}

record_unknown_question_json = {
    "name": "record_unknown_question",
    "description": "Always use this tool to record any question that couldn't be answered as you didn't know the answer",
    "parameters": {
        "type": "object",
        "properties": {
            "question": {"type": "string", "description": "The question that couldn't be answered"},
        },
        "required": ["question"],
        "additionalProperties": False,
    },
}

tools = [
    {"type": "function", "function": record_user_details_json},
    {"type": "function", "function": record_unknown_question_json},
]

# Short bio stands in for the LinkedIn PDF + summary.txt the course loads from disk.
NAME = "Ada Lovelace"
SUMMARY = (
    "Ada Lovelace is a software engineer specializing in Python and agentic AI systems. "
    "She worked for 6 years building data pipelines at a fintech startup, then moved into "
    "AI engineering. She studied mathematics at university and lives in London. "
    "Her favourite tools are Python, uv, and Ollama for local model development."
)

SYSTEM_PROMPT = (
    f"You are acting as {NAME}, answering questions on {NAME}'s personal website about "
    f"her career, background, skills and experience. Represent her faithfully and professionally. "
    f"If the background below contains the answer, just answer directly and do NOT call any tool. "
    f"If and ONLY if you do not know the answer (it is not in the background), you MUST call the "
    f"record_unknown_question tool to record the question instead of guessing. Use the real tool-"
    f"calling mechanism; never write a tool call as plain text. If the user shares an email, call "
    f"record_user_details.\n\n## Background on {NAME}:\n{SUMMARY}\n\n"
    f"Stay in character as {NAME}."
)


def handle_tool_calls(tool_calls):
    results = []
    for tc in tool_calls:
        name = tc.function.name
        args = json.loads(tc.function.arguments)
        print(f"   -> tool called: {name}({args})")
        fn = globals().get(name)
        result = fn(**args) if fn else {}
        results.append({"role": "tool", "content": json.dumps(result), "tool_call_id": tc.id})
    return results


def chat_once(user_message):
    print(f"\nUSER: {user_message}")
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
    done = False
    final = ""
    loops = 0
    while not done and loops < 5:
        loops += 1
        resp = client.chat.completions.create(
            model=MODEL, messages=messages, tools=tools, max_tokens=150
        )
        choice = resp.choices[0]
        if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
            results = handle_tool_calls(choice.message.tool_calls)
            messages.append(choice.message)
            messages.extend(results)
        else:
            final = (choice.message.content or "").strip()
            done = True
    print(f"AGENT: {final}")
    return final


def main():
    print("=" * 60)
    print(f"CAREER AGENT - digital twin of {NAME}")
    print(f"MODEL: {MODEL}  (local Ollama, no paid key; pushover is stubbed)")
    print("=" * 60)

    # Q1: answerable from the bio.
    before = len(FIRED)
    chat_once("Which programming language does Ada specialize in?")
    print(f"   tools fired this turn: {FIRED[before:] or 'none'}")

    # Q2: unknown -> should trigger record_unknown_question.
    before = len(FIRED)
    chat_once("What is Ada's favourite type of pizza?")
    print(f"   tools fired this turn: {FIRED[before:] or 'none'}")

    print("\n" + "=" * 60)
    print(f"ALL TOOLS FIRED THIS RUN: {FIRED or 'none'}")
    print("=" * 60)
    print("[DONE]")


if __name__ == "__main__":
    main()
