"""Lab 10: connect to the catalog's MCP server and give its tools to an agent."""
import asyncio
import sys

from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient

from harbor.config import ROOT, get_model

client = MultiServerMCPClient({
    "catalog": {
        "transport": "stdio",            # start the server as a child process and talk over stdin/stdout
        "command": sys.executable,       # the same Python that runs this lab
        "args": ["-m", "harbor.mcp_server"],
        "cwd": str(ROOT),
    }
})


async def main():
    tools = await client.get_tools()
    print("1) Tools discovered over MCP:")
    for t in tools:
        print(f"   {t.name}: {t.description}")

    resources = await client.get_resources("catalog")
    print("\n2) Resource catalog://genres:", resources[0].as_string())

    agent = create_agent(get_model(), tools, system_prompt="You help visitors of Harbor City Library. Use the tools.")
    result = await agent.ainvoke({"messages": [("user", "Is there a book about radios, and can I borrow it today?")]})
    print("\n3) Agent run:")
    for m in result["messages"][1:]:
        if m.type == "ai" and m.tool_calls:
            print("   calls:", [(c["name"], c["args"]) for c in m.tool_calls])
        elif m.type == "tool":
            print(f"   {m.name} -> {str(m.content)[:90]!r}")
        else:
            print("   answer:", m.content)


asyncio.run(main())
