"""A small tool-using agent: the model decides which tool to call, the code runs it, repeat."""
import json
from datetime import date

from aie import config
from aie.config import DATA
from aie.docs import load_chunks
from aie.llm import client
from aie.retrieve import Hybrid

ORDERS = {o["id"]: o for o in json.loads((DATA / "orders.json").read_text(encoding="utf-8"))}
_retriever = None


def search_docs(query: str) -> str:
    global _retriever
    _retriever = _retriever or Hybrid(load_chunks())
    return "\n\n".join(f"[{c.id}] {c.text}" for c, _ in _retriever.search(query, k=3))


def make_get_order(customer_id):
    def get_order(order_id: str) -> str:
        order = ORDERS.get(order_id.strip().upper())
        # Authorization lives in the tool, not in the prompt: the model can't talk its way past this check.
        if not order or order["customer"] != customer_id:
            return f"No order {order_id} found for this customer."
        return json.dumps(order)
    return get_order


TODAY = date(2026, 10, 12)  # fixed so the lab's results are repeatable


def days_since(iso_date: str) -> str:
    return str((TODAY - date.fromisoformat(iso_date)).days)

TOOLS = [
    {"type": "function", "function": {
        "name": "search_docs", "description": "Search the shop's policies (returns, warranty, shipping, battery care, sizing, service plans, stores, payment).",
        "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "get_order", "description": "Look up one of the current customer's orders by its number, like TH-10234.",
        "parameters": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]}}},
    {"type": "function", "function": {
        "name": "days_since", "description": "Number of days between a date (YYYY-MM-DD) and today.",
        "parameters": {"type": "object", "properties": {"iso_date": {"type": "string"}}, "required": ["iso_date"]}}},
]

SYSTEM = f"""You are the support agent of Trailhead Bikes. Today is {TODAY.isoformat()}.
Use the tools to look up policies and orders; never guess a policy, price or date.
When you have what you need, answer the customer in two or three sentences."""


def run_agent(question, customer_id="c-001", max_steps=6, model=None, verbose=True):
    """Returns (answer, trace). The trace lists every tool call, for debugging and evaluation."""
    tools = {"search_docs": search_docs, "get_order": make_get_order(customer_id), "days_since": days_since}
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}]
    trace = []
    for step in range(max_steps):
        response = client.chat.completions.create(
            model=model or config.MODEL, messages=messages, tools=TOOLS, temperature=0)
        message = response.choices[0].message
        if not message.tool_calls:
            return message.content, trace
        messages.append(message.model_dump(exclude_none=True))
        for call in message.tool_calls:
            name = call.function.name
            try:
                args = json.loads(call.function.arguments or "{}")
                result = tools[name](**args)
            except Exception as error:  # a bad tool call becomes feedback the model can recover from
                args, result = call.function.arguments, f"Tool error: {error}"
            trace.append({"step": step, "tool": name, "args": args, "result": result[:200]})
            if verbose:
                print(f"   step {step}: {name}({args}) -> {result[:90]!r}")
            messages.append({"role": "tool", "tool_call_id": call.id, "content": result})
    return "Sorry, I could not finish this request. A colleague will contact you.", trace
