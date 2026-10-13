"""Lab 03: reusable prompts with variables, chat history and examples."""
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, FewShotChatMessagePromptTemplate, MessagesPlaceholder

from harbor.config import get_model

model = get_model()

# 1. A template with variables. format_messages shows exactly what the model will receive.
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are the assistant of Harbor City Library's {branch}. Answer in {language}, in one sentence."),
    ("human", "{question}"),
])
filled = prompt.format_messages(branch="Lighthouse Branch", language="French", question="When is story time?")
for m in filled:
    print(f"{m.type:>6}: {m.content}")

# 2. Prompt | model | parser: a chain. The parser turns the AIMessage into a plain string.
chain = prompt | model | StrOutputParser()
print("\n2) chain:", chain.invoke({"branch": "Central Library", "language": "English", "question": "Do you have a maker space?"}))

# 3. MessagesPlaceholder: slot a whole conversation into the prompt.
with_history = ChatPromptTemplate.from_messages([
    ("system", "You are a friendly librarian. Use the conversation so far."),
    MessagesPlaceholder("history"),
    ("human", "{question}"),
])
history = [HumanMessage("My name is Lea and I love science fiction."), AIMessage("Nice to meet you, Lea!")]
print("\n3) history:", (with_history | model | StrOutputParser()).invoke({"history": history, "question": "What's my name and favourite genre?"}))

# 4. Few-shot: show the model examples of the exact output style you want.
examples = [
    {"title": "The Quiet Engine", "tag": "science fiction · adults · 2021"},
    {"title": "The Little Crab Who Could", "tag": "children · picture book · 2020"},
]
few_shot = FewShotChatMessagePromptTemplate(
    examples=examples,
    example_prompt=ChatPromptTemplate.from_messages([("human", "{title}"), ("ai", "{tag}")]),
)
tagger = ChatPromptTemplate.from_messages([
    ("system", "Reply with a short catalog tag in the same style as the examples, nothing else."),
    few_shot,
    ("human", "{title}"),
]) | model | StrOutputParser()
print("\n4) few-shot:", tagger.invoke({"title": "Tides of Harbor City: A History"}))
