"""Lab 01: talk to a chat model through LangChain: invoke, messages, stream, batch."""
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage

from harbor.config import MODEL, NUM_CTX, get_model

model = get_model()

# 1. The simplest call: a string in, an AIMessage out.
reply = model.invoke("What is a public library? Answer in one sentence.")
print("1) invoke:", reply.content)
print("   usage:", reply.usage_metadata)

# 2. A list of messages: the system message sets the role, the human message asks.
messages = [
    SystemMessage("You are the assistant of Harbor City Library. Be brief and friendly."),
    HumanMessage("Hi! Can you help me find a book about the sea?"),
]
print("\n2) with a system message:", model.invoke(messages).content)

# 3. Streaming: print each piece as soon as it arrives.
print("\n3) stream: ", end="")
for chunk in model.stream("Name three things people can do in a library, as a comma-separated list."):
    print(chunk.content, end="|", flush=True)
print()

# 4. Batch: several independent prompts in one call (run in parallel threads).
answers = model.batch(["Translate 'library' into French.", "Translate 'library' into Spanish."])
print("\n4) batch:", [a.content for a in answers])

# 5. The same model through the provider-agnostic factory: only the string changes per provider.
same = init_chat_model(f"ollama:{MODEL}", temperature=0, num_ctx=NUM_CTX)
print("\n5) init_chat_model:", type(same).__name__, "->", same.invoke("Say 'ready' and nothing else.").content)
