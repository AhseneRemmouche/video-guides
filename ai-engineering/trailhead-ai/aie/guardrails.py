"""Checks that run before the model sees a message (input) and before the customer sees a reply (output)."""
import re

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
PHONE = re.compile(r"(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}")
CARD = re.compile(r"\b\d(?:[ -]?\d){12,18}\b")

INJECTION_PATTERNS = [
    r"ignore (all |your |the )?(previous |above )?(instructions|rules)",
    r"you are now", r"system prompt", r"developer mode", r"reveal .*(prompt|instructions)",
]


def redact_pii(text):
    """Replace personal data with placeholders before it is sent to a model or written to logs."""
    text = CARD.sub("[CARD]", text)
    text = EMAIL.sub("[EMAIL]", text)
    return PHONE.sub("[PHONE]", text)


def looks_like_injection(text):
    return any(re.search(p, text, re.IGNORECASE) for p in INJECTION_PATTERNS)


def check_input(text):
    """Returns (allowed, cleaned_text, reason)."""
    if len(text) > 2000:
        return False, text, "message too long"
    if looks_like_injection(text):
        return False, text, "possible prompt injection"
    return True, redact_pii(text), ""


def check_output(answer, allowed_chunk_ids):
    """Returns (allowed, reason). A grounded answer must cite only chunks it was given."""
    cited = set(re.findall(r"\[([a-z-]+#\d+)\]", answer))
    if "i don't know" in answer.lower():
        return True, ""
    if not cited:
        return False, "no citation"
    if not cited <= set(allowed_chunk_ids):
        return False, f"cites chunks it was not given: {sorted(cited - set(allowed_chunk_ids))}"
    if re.search(r"\b(free bikes?|FREEBIKE)\b", answer, re.IGNORECASE):
        return False, "promises something the shop never offers"
    return True, ""
