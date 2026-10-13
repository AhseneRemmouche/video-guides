"""Tests that need no model: run them with `uv run pytest`."""
from langchain_core.messages import AIMessage, HumanMessage, trim_messages
from langchain_core.runnables import RunnableLambda

from harbor import mcp_server
from harbor.catalog import MEMBERS, check_availability, get_member_account, place_hold, search_catalog
from harbor.knowledge import format_docs, load_policies, split


def test_policies_load_and_split():
    docs = load_policies()
    assert len(docs) == 6
    chunks = split(docs)
    assert all(len(c.page_content) <= 400 for c in chunks)
    assert "[fees.md]" in format_docs([c for c in chunks if c.metadata["source"].endswith("fees.md")][:1])


def test_catalog_tools():
    assert "B001" in search_catalog.invoke({"query": "Mara Quint"})
    assert "0 of 4" in check_availability.invoke({"item_id": "b010"})  # ids are case-insensitive
    assert "16.00 EUR" in get_member_account.invoke({"member_id": "M-1003"})


def test_search_needs_the_word_inside_the_text():
    # The weakness lab 10 shows: "radios" does not occur inside "Radio", so nothing matches.
    assert search_catalog.invoke({"query": "radios"}).startswith("No items")
    assert "B011" in search_catalog.invoke({"query": "radio"})


def test_place_hold_changes_memory_only():
    before = list(MEMBERS["M-1001"]["holds"])
    assert "Hold placed" in place_hold.invoke({"member_id": "M-1001", "item_id": "B003"})
    MEMBERS["M-1001"]["holds"] = before  # undo, the JSON file was never touched


def test_mcp_server_functions():
    assert "B011" in mcp_server.search_catalog("radio")
    assert "music" in mcp_server.genres()


def test_trim_keeps_recent_turns():
    history = [HumanMessage("q1"), AIMessage("a1"), HumanMessage("q2"), AIMessage("a2")]
    kept = trim_messages(history, max_tokens=12, token_counter="approximate", strategy="last", start_on="human")
    assert kept[0].content == "q2"


def test_runnable_composition():
    chain = RunnableLambda(str.upper) | RunnableLambda(len)
    assert chain.invoke("abc") == 3
    assert chain.batch(["a", "ab"]) == [1, 2]
