"""Log every request to SQLite so you can debug it later and learn from user feedback."""
import json
import sqlite3
import uuid
from datetime import datetime, timezone

from aie.config import RUNS

SCHEMA = """
CREATE TABLE IF NOT EXISTS traces (
    id TEXT PRIMARY KEY, created TEXT, question TEXT, answer TEXT, chunks TEXT,
    model TEXT, input_tokens INT, output_tokens INT, seconds REAL, prompt TEXT
);
CREATE TABLE IF NOT EXISTS feedback (
    trace_id TEXT REFERENCES traces(id), rating INT, comment TEXT, created TEXT
);
"""


def connect(path=RUNS / "traces.db"):
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.executescript(SCHEMA)
    return db


def log_trace(db, question, out, prompt):
    trace_id = uuid.uuid4().hex[:8]
    r = out["reply"]
    db.execute("INSERT INTO traces VALUES (?,?,?,?,?,?,?,?,?,?)", (
        trace_id, datetime.now(timezone.utc).isoformat(), question, out["answer"], json.dumps(out["chunks"]),
        r.model, r.input_tokens, r.output_tokens, round(r.seconds, 2), prompt))
    db.commit()
    return trace_id


def log_feedback(db, trace_id, rating, comment=""):
    """rating: +1 (thumbs up) or -1 (thumbs down)."""
    db.execute("INSERT INTO feedback VALUES (?,?,?,?)", (trace_id, rating, comment, datetime.now(timezone.utc).isoformat()))
    db.commit()
