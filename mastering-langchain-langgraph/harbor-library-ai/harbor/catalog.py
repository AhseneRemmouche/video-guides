"""The library's catalog and member records, and the tools an agent may call on them."""
import csv
import json

from langchain_core.tools import tool

from harbor.config import DATA

with open(DATA / "catalog.csv", encoding="utf-8") as f:
    CATALOG = {row["id"]: row for row in csv.DictReader(f)}
MEMBERS = json.loads((DATA / "members.json").read_text(encoding="utf-8"))


@tool
def search_catalog(query: str) -> str:
    """Search the catalog by words in the title, author or genre. Returns matching items with their ids."""
    words = query.lower().split()
    hits = [b for b in CATALOG.values()
            if any(w in f"{b['title']} {b['author']} {b['genre']}".lower() for w in words)]
    if not hits:
        return f"No items match '{query}'."
    return "\n".join(f"{b['id']}: {b['title']} by {b['author']} ({b['format']}, {b['year']})" for b in hits[:5])


@tool
def check_availability(item_id: str) -> str:
    """Tell how many copies of an item (id like B004) are on the shelf, and at which branch."""
    b = CATALOG.get(item_id.strip().upper())
    if not b:
        return f"There is no item {item_id}."
    return f"{b['title']}: {b['available']} of {b['copies']} copies available at {b['branch']}."


@tool
def get_member_account(member_id: str) -> str:
    """Show a member's loans with due dates, holds and unpaid fees. Member ids look like M-1001."""
    m = MEMBERS.get(member_id.strip().upper())
    if not m:
        return f"There is no member {member_id}."
    loans = ", ".join(f"{CATALOG[l['id']]['title']} (due {l['due']})" for l in m["loans"]) or "none"
    return f"{m['name']} ({m['card']} card). Loans: {loans}. Holds: {m['holds'] or 'none'}. Fees: {m['fees_eur']:.2f} EUR."


@tool
def place_hold(member_id: str, item_id: str) -> str:
    """Place a hold on an item for a member. This changes the member's account."""
    m, b = MEMBERS.get(member_id.strip().upper()), CATALOG.get(item_id.strip().upper())
    if not m or not b:
        return "Unknown member or item."
    if len(m["holds"]) >= 5:
        return "This member already has 5 holds, the maximum."
    m["holds"].append(b["id"])  # in memory only: the labs never write the JSON file
    return f"Hold placed on {b['title']} for {m['name']}. We keep it for 7 days once it is back."


READ_TOOLS = [search_catalog, check_availability, get_member_account]
ALL_TOOLS = READ_TOOLS + [place_hold]
