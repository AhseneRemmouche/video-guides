"""
A simplified trading `Account` business-logic class for the Week 6 MCP demo.

This mirrors the shape of the course's `accounts.py` (balance, buy/sell shares,
holdings, transactions, a JSON `report`) but is deliberately trimmed so the demo
runs with NO external keys:

  * MARKET PRICES ARE FAKE. The real course calls Polygon.io (needs a paid key)
    via `market.get_share_price`. Here `get_share_price` returns a fixed, made-up
    price per symbol so `buy_shares` / `sell_shares` work offline. This is clearly
    not real market data -- it is a stub so the MCP plumbing can be demonstrated.
  * The store is a local SQLite file (`accounts.db` next to this module), so state
    survives across the separate tool calls the MCP server makes in one session.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel

INITIAL_BALANCE = 10_000.0
SPREAD = 0.002  # the tiny buy/sell spread, as in the course

DB_PATH = Path(__file__).resolve().parent / "accounts.db"

# --- FAKE market data -------------------------------------------------------
# The real course uses Polygon.io here. These are fixed, invented prices so the
# demo needs no API key and gives repeatable results.
_FAKE_PRICES: dict[str, float] = {
    "AAPL": 190.0,
    "MSFT": 410.0,
    "GOOGL": 170.0,
    "AMZN": 185.0,
    "TSLA": 250.0,
    "NVDA": 130.0,
}


def get_share_price(symbol: str) -> float:
    """Return a FAKE fixed share price for a symbol (no real market data)."""
    return _FAKE_PRICES.get(symbol.upper(), 100.0)


# --- tiny SQLite store ------------------------------------------------------
def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS accounts (name TEXT PRIMARY KEY, data TEXT)")
    return conn


def _read_account(name: str) -> dict | None:
    conn = _connect()
    try:
        row = conn.execute("SELECT data FROM accounts WHERE name = ?", (name,)).fetchone()
        return json.loads(row[0]) if row else None
    finally:
        conn.close()


def _write_account(name: str, data: dict) -> None:
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO accounts (name, data) VALUES (?, ?) "
            "ON CONFLICT(name) DO UPDATE SET data = excluded.data",
            (name, json.dumps(data)),
        )
        conn.commit()
    finally:
        conn.close()


class Transaction(BaseModel):
    symbol: str
    quantity: int  # negative quantity means a sell
    price: float
    timestamp: str
    rationale: str

    def total(self) -> float:
        return self.quantity * self.price


class Account(BaseModel):
    name: str
    balance: float
    holdings: dict[str, int]
    transactions: list[Transaction]

    @classmethod
    def get(cls, name: str) -> "Account":
        """Load an account by name, creating it with the initial balance if new."""
        fields = _read_account(name.lower())
        if not fields:
            fields = {
                "name": name.lower(),
                "balance": INITIAL_BALANCE,
                "holdings": {},
                "transactions": [],
            }
            _write_account(name.lower(), fields)
        return cls(**fields)

    def save(self) -> None:
        _write_account(self.name.lower(), self.model_dump())

    def buy_shares(self, symbol: str, quantity: int, rationale: str) -> str:
        """Buy shares if funds allow; records a transaction and returns a report."""
        price = get_share_price(symbol)
        buy_price = price * (1 + SPREAD)
        total_cost = buy_price * quantity
        if total_cost > self.balance:
            raise ValueError("Insufficient funds to buy shares.")

        self.holdings[symbol] = self.holdings.get(symbol, 0) + quantity
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.transactions.append(
            Transaction(symbol=symbol, quantity=quantity, price=buy_price,
                        timestamp=timestamp, rationale=rationale)
        )
        self.balance -= total_cost
        self.save()
        return "Completed. " + self.report()

    def sell_shares(self, symbol: str, quantity: int, rationale: str) -> str:
        """Sell shares if enough are held; records a transaction and returns a report."""
        if self.holdings.get(symbol, 0) < quantity:
            raise ValueError(f"Cannot sell {quantity} shares of {symbol}. Not enough held.")

        price = get_share_price(symbol)
        sell_price = price * (1 - SPREAD)
        total_proceeds = sell_price * quantity

        self.holdings[symbol] -= quantity
        if self.holdings[symbol] == 0:
            del self.holdings[symbol]
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.transactions.append(
            Transaction(symbol=symbol, quantity=-quantity, price=sell_price,
                        timestamp=timestamp, rationale=rationale)
        )
        self.balance += total_proceeds
        self.save()
        return "Completed. " + self.report()

    def portfolio_value(self) -> float:
        total = self.balance
        for symbol, quantity in self.holdings.items():
            total += get_share_price(symbol) * quantity
        return total

    def report(self) -> str:
        """Return the account as a JSON string (balance, holdings, value)."""
        data = self.model_dump()
        data["total_portfolio_value"] = self.portfolio_value()
        return json.dumps(data)


if __name__ == "__main__":
    # Tiny self-test (no agent, no MCP): prove the business logic works.
    acc = Account.get("demo")
    print("start balance:", acc.balance)
    print(acc.buy_shares("AAPL", 5, "self-test"))
    print("holdings:", acc.holdings, "balance:", round(acc.balance, 2))
