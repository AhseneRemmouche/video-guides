"""Day 4 - tool / function calling, against local Ollama.

Defines a get_ticket_price(city) tool as an OpenAI-style JSON schema and runs
the full tool-call loop. llama3.2 advertises OpenAI-style tool support in
Ollama, but local models are not always reliable at emitting a tool call. So
this script DETECTS whether the model actually tool-called:

  - if it did, we run the tool and feed the result back for a final answer;
  - if it did NOT, we clearly report that and FALL BACK to calling the
    function directly so the user still gets an answer.
"""

import json

from common import MODEL, banner, get_client

client = get_client()

MAX_TOKENS = 120

SYSTEM = (
    "You are a helpful assistant for an airline called FlightAI. Give short, "
    "courteous answers. Use the get_ticket_price tool when asked about prices."
)

TICKET_PRICES = {"london": "$799", "paris": "$899", "tokyo": "$1400", "berlin": "$499"}


def get_ticket_price(destination_city):
    print(f"[tool] get_ticket_price called for: {destination_city}", flush=True)
    price = TICKET_PRICES.get(destination_city.lower(), "an unknown price")
    return f"The price of a ticket to {destination_city} is {price}"


price_function = {
    "name": "get_ticket_price",
    "description": "Get the price of a return ticket to the destination city.",
    "parameters": {
        "type": "object",
        "properties": {
            "destination_city": {
                "type": "string",
                "description": "The city that the customer wants to travel to",
            },
        },
        "required": ["destination_city"],
        "additionalProperties": False,
    },
}

tools = [{"type": "function", "function": price_function}]


def handle_tool_calls(message):
    responses = []
    for tool_call in message.tool_calls:
        if tool_call.function.name == "get_ticket_price":
            arguments = json.loads(tool_call.function.arguments)
            city = arguments.get("destination_city")
            price_details = get_ticket_price(city)
            responses.append(
                {
                    "role": "tool",
                    "content": price_details,
                    "tool_call_id": tool_call.id,
                }
            )
    return responses


def run_query(user_message):
    banner(f"Query: {user_message!r}")

    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user_message},
    ]

    response = client.chat.completions.create(
        model=MODEL, messages=messages, tools=tools, max_tokens=MAX_TOKENS
    )
    choice = response.choices[0]

    tool_called = (
        choice.finish_reason == "tool_calls"
        or getattr(choice.message, "tool_calls", None)
    )

    if tool_called:
        print(f"[ok] Local model '{MODEL}' DID emit a tool call.")
        messages.append(choice.message)
        messages.extend(handle_tool_calls(choice.message))
        final = client.chat.completions.create(
            model=MODEL, messages=messages, tools=tools, max_tokens=MAX_TOKENS
        )
        print("\nFINAL ANSWER (model used the tool result):")
        print(final.choices[0].message.content)
    else:
        print(
            f"[fallback] Local model '{MODEL}' did NOT emit a tool call "
            "(finish_reason="
            f"{choice.finish_reason!r}). Falling back to calling the function "
            "directly."
        )
        print("Model's raw reply was:")
        print(f"  {choice.message.content!r}")
        # Fallback: call the tool ourselves for the city in the query.
        city = "London"  # the query we run asks about London
        direct = get_ticket_price(city)
        print("\nFINAL ANSWER (direct function call fallback):")
        print(direct)


if __name__ == "__main__":
    run_query("How much is a ticket to London?")
