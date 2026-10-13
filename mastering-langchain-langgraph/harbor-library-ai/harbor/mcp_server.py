"""An MCP server that offers the library catalog to any MCP client. Run: python -m harbor.mcp_server"""
from mcp.server.fastmcp import FastMCP

from harbor.catalog import CATALOG

mcp = FastMCP("harbor-catalog")


@mcp.tool()
def search_catalog(query: str) -> str:
    """Search the Harbor City Library catalog by words in the title, author or genre."""
    words = query.lower().split()
    hits = [b for b in CATALOG.values()
            if any(w in f"{b['title']} {b['author']} {b['genre']}".lower() for w in words)]
    return "\n".join(f"{b['id']}: {b['title']} by {b['author']}" for b in hits[:5]) or f"No items match '{query}'."


@mcp.tool()
def check_availability(item_id: str) -> str:
    """How many copies of an item (id like B004) are on the shelf, and where."""
    b = CATALOG.get(item_id.strip().upper())
    return f"{b['title']}: {b['available']} of {b['copies']} available at {b['branch']}." if b else f"No item {item_id}."


@mcp.resource("catalog://genres")
def genres() -> str:
    """The list of genres in the catalog."""
    return ", ".join(sorted({b["genre"] for b in CATALOG.values()}))


if __name__ == "__main__":
    mcp.run(transport="stdio")
