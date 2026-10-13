"""Lab 08: the RAG chain rebuilt as a LangGraph graph with a router."""
from typing import Literal, TypedDict

from langchain_core.documents import Document
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

from harbor.config import get_model
from harbor.knowledge import build_vector_store, format_docs

retriever = build_vector_store().as_retriever(search_kwargs={"k": 2})
model = get_model()


class State(TypedDict, total=False):
    question: str
    route: str
    docs: list[Document]
    answer: str


class Route(BaseModel):
    route: Literal["library", "other"]


def classify(state: State) -> State:
    prompt = ("Is this question about a public library (cards, loans, fees, branches, rooms, digital services)? "
              f"Answer 'library' or 'other'.\nQuestion: {state['question']}")
    return {"route": model.with_structured_output(Route).invoke(prompt).route}


def retrieve(state: State) -> State:
    return {"docs": retriever.invoke(state["question"])}


def generate(state: State) -> State:
    prompt = (f"Answer in one or two sentences using only this context. If it is not there, say you don't know.\n\n"
              f"{format_docs(state['docs'])}\n\nQuestion: {state['question']}")
    return {"answer": model.invoke(prompt).content}


def decline(state: State) -> State:
    return {"answer": "I can only help with Harbor City Library questions."}


def pick_next(state: State) -> str:
    return "retrieve" if state["route"] == "library" else "decline"


builder = StateGraph(State)
builder.add_node("classify", classify)
builder.add_node("retrieve", retrieve)
builder.add_node("generate", generate)
builder.add_node("decline", decline)
builder.add_edge(START, "classify")
builder.add_conditional_edges("classify", pick_next, ["retrieve", "decline"])
builder.add_edge("retrieve", "generate")
builder.add_edge("generate", END)
builder.add_edge("decline", END)
graph = builder.compile()

print("1) The graph as Mermaid text (paste it into mermaid.live to see it):")
print(graph.get_graph().draw_mermaid())

print("2) Running it. stream_mode='updates' shows each node as it finishes:")
for question in ["How many items can a junior card borrow?", "Who won the football match yesterday?"]:
    print(f"\n   Q: {question}")
    for update in graph.stream({"question": question}, stream_mode="updates"):
        for node, change in update.items():
            shown = {k: (f"{len(v)} documents" if k == "docs" else v) for k, v in change.items()}
            print(f"   [{node}] {shown}")
