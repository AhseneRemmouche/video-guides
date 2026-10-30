"""
The accounts MCP server.

`FastMCP` (from the `mcp` package) turns plain Python functions into MCP tools and
resources. Running this file with the stdio transport makes it a standalone MCP
server that any MCP client -- here, an OpenAI Agents SDK agent -- can launch and
talk to over the process's stdin/stdout.

Tools exposed:  get_balance, get_holdings, buy_shares, sell_shares
Resource:       accounts://accounts_server/{name}  (a read-only JSON account report)
"""

from mcp.server.fastmcp import FastMCP

from accounts import Account

mcp = FastMCP("accounts_server")


@mcp.tool()
async def get_balance(name: str) -> float:
    """Get the cash balance of the given account name.

    Args:
        name: The name of the account holder
    """
    return Account.get(name).balance


@mcp.tool()
async def get_holdings(name: str) -> dict[str, int]:
    """Get the share holdings of the given account name.

    Args:
        name: The name of the account holder
    """
    return Account.get(name).holdings


@mcp.tool()
async def buy_shares(name: str, symbol: str, quantity: int, rationale: str) -> str:
    """Buy shares of a stock for the given account.

    Args:
        name: The name of the account holder
        symbol: The ticker symbol of the stock (e.g. AAPL)
        quantity: The number of shares to buy
        rationale: Why this purchase fits the account's strategy
    """
    return Account.get(name).buy_shares(symbol, quantity, rationale)


@mcp.tool()
async def sell_shares(name: str, symbol: str, quantity: int, rationale: str) -> str:
    """Sell shares of a stock from the given account.

    Args:
        name: The name of the account holder
        symbol: The ticker symbol of the stock (e.g. AAPL)
        quantity: The number of shares to sell
        rationale: Why this sale fits the account's strategy
    """
    return Account.get(name).sell_shares(symbol, quantity, rationale)


@mcp.resource("accounts://accounts_server/{name}")
async def read_account_resource(name: str) -> str:
    """A read-only resource: the account as a JSON report."""
    return Account.get(name.lower()).report()


if __name__ == "__main__":
    # stdio transport: the client launches this process and speaks MCP over
    # stdin/stdout. This is what `MCPServerStdio` in client_demo.py connects to.
    mcp.run(transport="stdio")
