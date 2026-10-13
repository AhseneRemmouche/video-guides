"""Route each message to the cheapest path that can handle it."""
from typing import Literal

from pydantic import BaseModel

from aie.llm import chat_json


class Route(BaseModel):
    route: Literal["smalltalk", "policy_question", "order_question", "out_of_scope"]


ROUTER_PROMPT = """Classify the customer's message for a bike shop's support system.
smalltalk: greetings or thanks. policy_question: returns, warranty, shipping, batteries, sizes, service plans, stores, payment.
order_question: about a specific order. out_of_scope: anything else. Reply with JSON."""


def route(message):
    return chat_json([{"role": "system", "content": ROUTER_PROMPT}, {"role": "user", "content": message}], Route, temperature=0).route
