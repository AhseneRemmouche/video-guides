"""Lab 03: turn a free-text customer message into validated JSON."""
from typing import Literal

from pydantic import BaseModel, Field

from aie.llm import chat_json


class Ticket(BaseModel):
    intent: Literal["return", "warranty", "shipping", "order_status", "other"]
    order_id: str | None = Field(pattern=r"^TH-\d{5}$", description="Order number like TH-10234, or null if the message has none")
    urgent: bool
    summary: str = Field(description="One short sentence")


SYSTEM = (
    "Extract a support ticket from the customer's message. Reply with JSON only.\n"
    "intent: return, warranty (something broken or not working), shipping, order_status or other.\n"
    "order_id: copy it only if it appears in the message, otherwise null. Never invent one."
)
messages = [
    "Hi, my order TH-10251 still hasn't arrived and I need the helmet for a race on Saturday!",
    "The battery of my Volt won't charge since yesterday, the light blinks red.",
    "Do you have stores in Paris?",
]

for text in messages:
    ticket = chat_json([{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}], Ticket, temperature=0)
    # Valid JSON is not the same as a correct answer: check facts you can check in code.
    if ticket.order_id and ticket.order_id not in text:
        print(f"  (model invented order_id {ticket.order_id}; replaced with None)")
        ticket.order_id = None
    print(text)
    print("  ->", ticket.model_dump())
