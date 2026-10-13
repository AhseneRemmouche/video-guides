"""One small wrapper around an OpenAI-compatible API (Ollama locally, or OpenAI).

Every call returns the text plus what it cost: tokens and seconds. Later labs log these numbers.
"""
import json
import time
from dataclasses import dataclass

from openai import OpenAI
from pydantic import BaseModel, ValidationError

from aie import config

client = OpenAI(base_url=config.BASE_URL, api_key=config.API_KEY)


@dataclass
class Reply:
    text: str
    model: str
    input_tokens: int
    output_tokens: int
    seconds: float


def chat(messages, model=None, **params):
    """Send a list of {"role", "content"} messages and return a Reply."""
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    if config.REASONING_EFFORT and "reasoning_effort" not in params:
        params["reasoning_effort"] = config.REASONING_EFFORT
    start = time.perf_counter()
    response = client.chat.completions.create(model=model or config.MODEL, messages=messages, **params)
    usage = response.usage
    return Reply(
        text=response.choices[0].message.content or "",
        model=response.model,
        input_tokens=usage.prompt_tokens if usage else 0,
        output_tokens=usage.completion_tokens if usage else 0,
        seconds=time.perf_counter() - start,
    )


def chat_json(messages, schema: type[BaseModel], model=None, retries=2, **params):
    """Ask for JSON that matches a Pydantic model; validate it and retry with the error if it doesn't."""
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    messages = list(messages)
    response_format = {
        "type": "json_schema",
        "json_schema": {"name": schema.__name__, "schema": schema.model_json_schema()},
    }
    for attempt in range(retries + 1):
        reply = chat(messages, model=model, response_format=response_format, **params)
        try:
            return schema.model_validate_json(reply.text)
        except ValidationError as error:
            if attempt == retries:
                raise
            messages += [
                {"role": "assistant", "content": reply.text},
                {"role": "user", "content": f"That JSON was invalid: {error.errors()[:3]}. Reply with corrected JSON only."},
            ]


def embed(texts, model=None):
    """Return one embedding vector (a list of floats) per input text."""
    response = client.embeddings.create(model=model or config.EMBED_MODEL, input=list(texts))
    return [item.embedding for item in response.data]


def to_json(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2)
