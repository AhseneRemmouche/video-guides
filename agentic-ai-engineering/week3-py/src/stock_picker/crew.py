import os

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from pydantic import BaseModel, Field
from typing import List

# Offline adaptations of the two keyed tools from the course:
#   - search_tool.WebSearchStubTool stands in for crewai_tools.SerperDevTool (needs SERPER_API_KEY)
#   - push_tool.PushNotificationTool logs instead of calling Pushover (needs PUSHOVER_* keys)
from .tools.push_tool import PushNotificationTool
from .tools.search_tool import WebSearchStubTool

from crewai.memory import LongTermMemory, ShortTermMemory, EntityMemory
from crewai.memory.storage.rag_storage import RAGStorage
from crewai.memory.storage.ltm_sqlite_storage import LTMSQLiteStorage


# ----- Pydantic structured-output models (unchanged from the course) -----------
class TrendingCompany(BaseModel):
    """ A company that is in the news and attracting attention """
    name: str = Field(description="Company name")
    ticker: str = Field(description="Stock ticker symbol")
    reason: str = Field(description="Reason this company is trending in the news")


class TrendingCompanyList(BaseModel):
    """ List of multiple trending companies that are in the news """
    companies: List[TrendingCompany] = Field(description="List of companies trending in the news")


class TrendingCompanyResearch(BaseModel):
    """ Detailed research on a company """
    name: str = Field(description="Company name")
    market_position: str = Field(description="Current market position and competitive analysis")
    future_outlook: str = Field(description="Future outlook and growth prospects")
    investment_potential: str = Field(description="Investment potential and suitability for investment")


class TrendingCompanyResearchList(BaseModel):
    """ A list of detailed research on all the companies """
    research_list: List[TrendingCompanyResearch] = Field(description="Comprehensive research on all trending companies")


# Toggle crew memory with STOCK_PICKER_MEMORY=0 (default: on). When on, it uses
# the local Ollama `nomic-embed-text` model for embeddings (the course used
# OpenAI's text-embedding-3-small, which needs a paid key).
USE_MEMORY = os.getenv("STOCK_PICKER_MEMORY", "1") not in ("0", "false", "False")

# Embedder used by short-term / entity memory. Points at local Ollama.
# crewai 0.203's embedder factory expects `model_name` (and an optional `url`)
# for the ollama provider -- not `model`.
OLLAMA_EMBEDDER = {
    "provider": "ollama",
    "config": {
        "model_name": os.getenv("STOCK_PICKER_EMBED_MODEL", "nomic-embed-text"),
        "url": os.getenv("OLLAMA_API_BASE", "http://localhost:11434")
        + "/api/embeddings",
    },
}


@CrewBase
class StockPicker():
    """StockPicker crew"""

    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def trending_company_finder(self) -> Agent:
        # Course: tools=[SerperDevTool()]. Replaced with the offline search stub.
        return Agent(config=self.agents_config['trending_company_finder'],
                     tools=[WebSearchStubTool()], memory=USE_MEMORY)

    @agent
    def financial_researcher(self) -> Agent:
        return Agent(config=self.agents_config['financial_researcher'],
                     tools=[WebSearchStubTool()])

    @agent
    def stock_picker(self) -> Agent:
        return Agent(config=self.agents_config['stock_picker'],
                     tools=[PushNotificationTool()], memory=USE_MEMORY)

    @task
    def find_trending_companies(self) -> Task:
        return Task(
            config=self.tasks_config['find_trending_companies'],
            output_pydantic=TrendingCompanyList,
        )

    @task
    def research_trending_companies(self) -> Task:
        return Task(
            config=self.tasks_config['research_trending_companies'],
            output_pydantic=TrendingCompanyResearchList,
        )

    @task
    def pick_best_company(self) -> Task:
        return Task(
            config=self.tasks_config['pick_best_company'],
        )

    @crew
    def crew(self) -> Crew:
        """Creates the StockPicker crew"""

        manager = Agent(
            config=self.agents_config['manager'],
            allow_delegation=True
        )

        common = dict(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.hierarchical,   # manager delegates to the worker agents
            verbose=True,
            manager_agent=manager,
        )

        if not USE_MEMORY:
            # Memory disabled (STOCK_PICKER_MEMORY=0): the crew still runs the
            # full hierarchical flow, it just doesn't persist/recall context.
            return Crew(memory=False, **common)

        return Crew(
            memory=True,
            # Long-term memory: persistent SQLite store across sessions.
            long_term_memory=LongTermMemory(
                storage=LTMSQLiteStorage(
                    db_path="./memory/long_term_memory_storage.db"
                )
            ),
            # Short-term memory: current-run context via RAG (embeddings).
            # Course used OpenAI embeddings; here we point RAG at local Ollama.
            short_term_memory=ShortTermMemory(
                storage=RAGStorage(
                    embedder_config=OLLAMA_EMBEDDER,
                    type="short_term",
                    path="./memory/",
                )
            ),
            # Entity memory: tracks key facts about entities (companies, people).
            entity_memory=EntityMemory(
                storage=RAGStorage(
                    embedder_config=OLLAMA_EMBEDDER,
                    type="short_term",
                    path="./memory/",
                )
            ),
            **common,
        )
