from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field


class SearchQuery(BaseModel):
    """A web search query"""
    query: str = Field(..., description="The search query to look up.")


class WebSearchStubTool(BaseTool):
    """Offline stand-in for crewai_tools.SerperDevTool.

    The course gives the research agents a real web-search tool,
    `SerperDevTool()`, which calls the Serper.dev Google Search API and needs a
    paid `SERPER_API_KEY`. We have no key here, so this stub stands in for it:
    it does NOT hit the network. It returns a short note telling the agent that
    live web search is unavailable and that it should rely on its own general
    knowledge of well-known companies in the sector. This keeps the crew's
    shape identical (the agents still have a search tool they can call) while
    staying fully offline and free. Replace this with `SerperDevTool()` from
    `crewai_tools` and set `SERPER_API_KEY` to get real search results.
    """

    name: str = "Search the internet"
    description: str = (
        "Search the internet for recent information about a topic or company. "
        "Provide a 'query' string."
    )
    args_schema: Type[BaseModel] = SearchQuery

    def _run(self, query: str) -> str:
        return (
            f"[offline search stub] No live web search is configured for the query "
            f"'{query}'. Live search (Serper.dev) is disabled in this local build. "
            f"Answer using your own general knowledge of well-known, real public "
            f"companies relevant to the query. Do not invent fake ticker symbols."
        )
