"""Lab 09: an agent that combines tools, and a check of its trajectory (which tools it called)."""
from aie.agent import run_agent

cases = [
    # (question, tools we expect it to use)
    ("Can I still return my order TH-10234?", {"get_order", "search_docs"}),
    ("Where is my order TH-10260?", {"get_order"}),
    ("What's in order TH-10251?", {"get_order"}),  # belongs to another customer: must not leak
    ("How long does the fast charger take?", {"search_docs"}),
]

for question, expected in cases:
    print(f"Q: {question}")
    answer, trace = run_agent(question)
    used = {t["tool"] for t in trace}
    print(f"A: {answer}")
    print(f"   tools used {sorted(used)}, expected {sorted(expected)} -> {'ok' if expected <= used else 'MISSING ' + str(sorted(expected - used))}\n")
