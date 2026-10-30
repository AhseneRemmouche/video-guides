"""Slimmed Sidekick - the worker/evaluator loop (wired to local Ollama).

This keeps the EXACT graph shape of the course's Sidekick (4_lab4.py and
4_langgraph__sidekick.py):

    START -> worker -> (tool call?) -> tools -> worker
                     -> (no tool)   -> evaluator -> (criteria met / input needed?) -> END
                                                 -> (not yet)                       -> worker

What is slimmed:
  * The course gives the worker Playwright browser tools + Serper + Pushover.
    Those need a browser / API keys, so here the worker gets two SAFE local
    tools instead: a calculator and a sandboxed Python snippet runner.
  * The evaluator still uses a structured-output Pydantic model
    (EvaluatorOutput: feedback, success_criteria_met, user_input_needed), exactly
    like the course, via with_structured_output.

To add the real browser tools from the course, install the `browser` extra and
uncomment the Playwright block in `_build_tools` (left commented so the core runs
with no browser).

Run it:  uv run python src/sidekick.py
"""

from datetime import datetime
from typing import Annotated, Any, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from common import make_llm


# --- Structured output for the evaluator (same fields as the course) --------
class EvaluatorOutput(BaseModel):
    feedback: str = Field(description="Feedback on the assistant's response")
    success_criteria_met: bool = Field(description="Whether the success criteria have been met")
    user_input_needed: bool = Field(
        description="True if more input is needed from the user, or clarifications, or the assistant is stuck"
    )


# --- Graph state (same shape as the course) --------------------------------
class State(TypedDict):
    messages: Annotated[list[Any], add_messages]
    success_criteria: str
    feedback_on_work: Optional[str]
    success_criteria_met: bool
    user_input_needed: bool


# --- Safe local tools (replacing Playwright / Serper / Pushover) -----------
@tool
def calculator(expression: str) -> str:
    """Evaluate a basic arithmetic expression, e.g. '120 * 0.15'."""
    allowed = set("0123456789+-*/(). ")
    if not set(expression) <= allowed:
        return "Error: only numbers and + - * / ( ) are allowed."
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception as exc:  # noqa: BLE001
        return f"Error: {exc}"


@tool
def run_python(code: str) -> str:
    """Run a short Python snippet and return whatever it printed.

    Use print() to produce output. Runs with no imports and no file/network access."""
    import contextlib
    import io

    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            exec(code, {"__builtins__": {"print": print, "range": range, "len": len}}, {})
    except Exception as exc:  # noqa: BLE001
        return f"Error: {exc}"
    return buf.getvalue() or "(no output - did you print()?)"


def _build_tools() -> list:
    """The worker's tools. Only safe local tools by default."""
    tools = [calculator, run_python]

    # --- OPTIONAL: the course's Playwright browser tools ------------------
    # Needs the `browser` extra (UV_NATIVE_TLS=1 uv sync --extra browser) and a
    # Chromium download (python -m playwright install chromium). Left commented
    # so the runnable core needs no browser.
    #
    # import nest_asyncio
    # from langchain_community.agent_toolkits import PlayWrightBrowserToolkit
    # from langchain_community.tools.playwright.utils import create_async_playwright_browser
    # nest_asyncio.apply()
    # browser = create_async_playwright_browser(headless=True)
    # tools += PlayWrightBrowserToolkit.from_browser(async_browser=browser).get_tools()

    return tools


class Sidekick:
    """The worker/evaluator agent, built as a LangGraph graph."""

    def __init__(self) -> None:
        self.tools = _build_tools()
        self.worker_llm_with_tools = make_llm().bind_tools(self.tools)
        self.evaluator_llm_with_output = make_llm().with_structured_output(EvaluatorOutput)
        self.memory = MemorySaver()
        self.graph = self._build_graph()

    # The worker: does the actual work, may call tools.
    def worker(self, state: State) -> dict:
        system_message = f"""You are a helpful assistant that can use tools to complete tasks.
You keep working on a task until either you have a question or clarification for the user, or the success criteria is met.
You have a calculator tool and a tool to run short Python snippets (use print() to get output).
The current date and time is {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

This is the success criteria:
{state["success_criteria"]}
You should reply either with a question for the user about this assignment, or with your final response.
If you have a question, clearly state it starting with "Question:". If you've finished, simply reply with the final answer."""

        if state.get("feedback_on_work"):
            system_message += f"""
Previously you thought you completed the assignment, but your reply was rejected because the success criteria was not met.
Here is the feedback on why this was rejected:
{state["feedback_on_work"]}
With this feedback, please continue, ensuring you meet the success criteria or have a question for the user."""

        # Replace any existing system message, else prepend one.
        messages = state["messages"]
        found = False
        for message in messages:
            if isinstance(message, SystemMessage):
                message.content = system_message
                found = True
        if not found:
            messages = [SystemMessage(content=system_message)] + messages

        response = self.worker_llm_with_tools.invoke(messages)
        return {"messages": [response]}

    # Router after the worker: tool call -> tools, otherwise -> evaluator.
    def worker_router(self, state: State) -> str:
        last = state["messages"][-1]
        if getattr(last, "tool_calls", None):
            return "tools"
        return "evaluator"

    @staticmethod
    def format_conversation(messages: list[Any]) -> str:
        out = "Conversation history:\n\n"
        for message in messages:
            if isinstance(message, HumanMessage):
                out += f"User: {message.content}\n"
            elif isinstance(message, AIMessage):
                out += f"Assistant: {message.content or '[Tool use]'}\n"
        return out

    # The evaluator: judges the worker's last answer against the success criteria.
    def evaluator(self, state: State) -> dict:
        last_response = state["messages"][-1].content
        system_message = (
            "You are an evaluator that decides if a task was completed successfully by an Assistant. "
            "Assess the Assistant's last response against the criteria. Give feedback and decide whether "
            "the success criteria are met and whether more input is needed from the user."
        )
        user_message = f"""You are evaluating a conversation between the User and Assistant.

{self.format_conversation(state["messages"])}

The success criteria for this assignment is:
{state["success_criteria"]}

And the final response from the Assistant that you are evaluating is:
{last_response}

Decide if the success criteria are met, and if more user input is required (a question, a clarification, or the assistant is stuck)."""
        if state.get("feedback_on_work"):
            user_message += f"\nPrior feedback you gave: {state['feedback_on_work']}\nIf the Assistant repeats mistakes, consider requiring user input."

        result = self.evaluator_llm_with_output.invoke(
            [SystemMessage(content=system_message), HumanMessage(content=user_message)]
        )
        return {
            "messages": [
                {"role": "assistant", "content": f"Evaluator Feedback: {result.feedback}"}
            ],
            "feedback_on_work": result.feedback,
            "success_criteria_met": result.success_criteria_met,
            "user_input_needed": result.user_input_needed,
        }

    # Router after the evaluator: done -> END, otherwise loop back to worker.
    def route_based_on_evaluation(self, state: State) -> str:
        if state["success_criteria_met"] or state["user_input_needed"]:
            return "END"
        return "worker"

    def _build_graph(self):
        gb = StateGraph(State)
        gb.add_node("worker", self.worker)
        gb.add_node("tools", ToolNode(tools=self.tools))
        gb.add_node("evaluator", self.evaluator)

        gb.add_conditional_edges("worker", self.worker_router, {"tools": "tools", "evaluator": "evaluator"})
        gb.add_edge("tools", "worker")
        gb.add_conditional_edges("evaluator", self.route_based_on_evaluation, {"worker": "worker", "END": END})
        gb.add_edge(START, "worker")
        return gb.compile(checkpointer=self.memory)

    def run(self, message: str, success_criteria: str, thread_id: str = "sidekick-1") -> dict:
        config = {"configurable": {"thread_id": thread_id}}
        state = {
            "messages": [{"role": "user", "content": message}],
            "success_criteria": success_criteria or "The answer should be clear and accurate",
            "feedback_on_work": None,
            "success_criteria_met": False,
            "user_input_needed": False,
        }
        return self.graph.invoke(state, config=config)


if __name__ == "__main__":
    print("=== Slimmed Sidekick: worker/evaluator loop (Ollama) ===\n")
    sidekick = Sidekick()
    print("Graph structure:")
    print(sidekick.graph.get_graph().draw_mermaid())
    print()

    result = sidekick.run(
        message="Use the calculator to work out a 15% tip on a $120 bill, then state the tip amount.",
        success_criteria="The reply states the tip amount in dollars for a 15% tip on $120.",
    )
    print("Worker answer :", result["messages"][-2].content)
    print("Evaluator      :", result["messages"][-1].content)
    print("Criteria met   :", result["success_criteria_met"])
    print("Input needed   :", result["user_input_needed"])
