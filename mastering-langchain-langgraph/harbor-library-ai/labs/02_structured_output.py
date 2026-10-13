"""Lab 02: get typed, validated data back instead of free text."""
from typing import Literal

from pydantic import BaseModel, Field

from harbor.config import get_model


class BookRequest(BaseModel):
    """What a library visitor is looking for."""
    topic: str = Field(description="The subject, in two to four words")
    audience: Literal["children", "teens", "adults"] = Field(description="Who the book is for")
    formats: list[Literal["book", "e-book", "audiobook", "DVD"]] = Field(description="Formats the visitor accepts")
    max_pages: int | None = Field(default=None, description="Maximum length if the visitor gives one, else null")


model = get_model()
structured = model.with_structured_output(BookRequest)

requests = [
    "My 8-year-old loves crabs and the beach. Anything short, under 40 pages? Paper or e-book is fine.",
    "I'd like an audiobook on the history of our harbor for my commute.",
]
for text in requests:
    result = structured.invoke(text)
    print(type(result).__name__, result.model_dump())

# include_raw=True also returns the raw AIMessage and any parsing error, so a failure does not raise.
vague = "Something fun to read."
raw = model.with_structured_output(BookRequest, include_raw=True).invoke(vague)
print("\ninclude_raw keys:", list(raw))
print("parsed:", raw["parsed"])
print("parsing_error:", str(raw["parsing_error"])[:200] if raw["parsing_error"] else None)
print("output tokens:", raw["raw"].usage_metadata["output_tokens"])


# A schema can also limit size: max_length becomes "maxItems" in the JSON schema, which Ollama enforces.
class BookRequestV2(BookRequest):
    formats: list[Literal["book", "e-book", "audiobook", "DVD"]] = Field(max_length=4, description="Formats the visitor accepts")


fixed = model.with_structured_output(BookRequestV2, include_raw=True).invoke(vague)
print("\nwith max_length=4:", fixed["parsed"], "| error:", fixed["parsing_error"])
