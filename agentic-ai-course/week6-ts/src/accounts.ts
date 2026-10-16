// Port of 6_mcp/accounts.py — the business logic of a trading account (written for the course by the Week 3 CrewAI
// engineering team): cash balance, holdings, transactions with a 0.2% spread, a report and an investment strategy.
// Differences: interfaces replace the Pydantic models, methods are camelCase (buy_shares -> buyShares), and the methods
// that need a share price are async because getSharePrice may call Polygon. The stored JSON keeps the Python field
// names (portfolio_value_time_series, ...), so accounts.db looks the same as the course's.
import { readAccount, writeAccount, writeLog } from "./database.js";
import { getSharePrice } from "./market.js";

const INITIAL_BALANCE = 10_000.0;
const SPREAD = 0.002;

export interface Transaction {
  symbol: string;
  quantity: number; // negative for a sale
  price: number;
  timestamp: string;
  rationale: string;
}

export interface AccountData {
  name: string;
  balance: number;
  strategy: string;
  holdings: Record<string, number>;
  transactions: Transaction[];
  portfolio_value_time_series: [string, number][];
}

/** "2025-05-20 14:03:07" in local time, like datetime.now().strftime("%Y-%m-%d %H:%M:%S"). */
export function timestampNow(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const total = (t: Transaction) => t.quantity * t.price;

export class Account implements AccountData {
  name = "";
  balance = INITIAL_BALANCE;
  strategy = "";
  holdings: Record<string, number> = {};
  transactions: Transaction[] = [];
  portfolio_value_time_series: [string, number][] = [];

  private constructor(fields: AccountData) {
    Object.assign(this, fields);
  }

  /** Load an account, creating it with $10,000 if it does not exist yet. */
  static get(name: string): Account {
    let fields = readAccount(name.toLowerCase()) as AccountData | null;
    if (!fields) {
      fields = { name: name.toLowerCase(), balance: INITIAL_BALANCE, strategy: "", holdings: {}, transactions: [], portfolio_value_time_series: [] };
      writeAccount(name, fields);
    }
    return new Account(fields);
  }

  /** The plain data, like Pydantic's model_dump(). */
  data(): AccountData {
    const { name, balance, strategy, holdings, transactions, portfolio_value_time_series } = this;
    return { name, balance, strategy, holdings, transactions, portfolio_value_time_series };
  }

  save(): void {
    writeAccount(this.name.toLowerCase(), this.data());
  }

  reset(strategy: string): void {
    this.balance = INITIAL_BALANCE;
    this.strategy = strategy;
    this.holdings = {};
    this.transactions = [];
    this.portfolio_value_time_series = [];
    this.save();
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error("Deposit amount must be positive.");
    this.balance += amount;
    console.log(`Deposited $${amount}. New balance: $${this.balance}`);
    this.save();
  }

  withdraw(amount: number): void {
    if (amount > this.balance) throw new Error("Insufficient funds for withdrawal.");
    this.balance -= amount;
    console.log(`Withdrew $${amount}. New balance: $${this.balance}`);
    this.save();
  }

  /** Buy shares at the current price plus the spread, if there is enough cash. */
  async buyShares(symbol: string, quantity: number, rationale: string): Promise<string> {
    const price = await getSharePrice(symbol);
    const buyPrice = price * (1 + SPREAD);
    const totalCost = buyPrice * quantity;

    if (totalCost > this.balance) throw new Error("Insufficient funds to buy shares.");
    else if (price === 0) throw new Error(`Unrecognized symbol ${symbol}`);

    this.holdings[symbol] = (this.holdings[symbol] ?? 0) + quantity;
    this.transactions.push({ symbol, quantity, price: buyPrice, timestamp: timestampNow(), rationale });
    this.balance -= totalCost;
    this.save();
    writeLog(this.name, "account", `Bought ${quantity} of ${symbol}`);
    return "Completed. Latest details:\n" + (await this.report());
  }

  /** Sell shares at the current price minus the spread, if enough are held. */
  async sellShares(symbol: string, quantity: number, rationale: string): Promise<string> {
    if ((this.holdings[symbol] ?? 0) < quantity) throw new Error(`Cannot sell ${quantity} shares of ${symbol}. Not enough shares held.`);

    const price = await getSharePrice(symbol);
    const sellPrice = price * (1 - SPREAD);
    const totalProceeds = sellPrice * quantity;

    this.holdings[symbol] -= quantity;
    if (this.holdings[symbol] === 0) delete this.holdings[symbol]; // sold out: remove from holdings
    this.transactions.push({ symbol, quantity: -quantity, price: sellPrice, timestamp: timestampNow(), rationale });
    this.balance += totalProceeds;
    this.save();
    writeLog(this.name, "account", `Sold ${quantity} of ${symbol}`);
    return "Completed. Latest details:\n" + (await this.report());
  }

  /** Cash plus every holding at today's price. */
  async calculatePortfolioValue(): Promise<number> {
    let totalValue = this.balance;
    for (const [symbol, quantity] of Object.entries(this.holdings)) totalValue += (await getSharePrice(symbol)) * quantity;
    return totalValue;
  }

  /** Profit or loss, computed exactly as in the course. */
  calculateProfitLoss(portfolioValue: number): number {
    const initialSpend = this.transactions.reduce((sum, t) => sum + total(t), 0);
    return portfolioValue - initialSpend - this.balance;
  }

  getHoldings(): Record<string, number> {
    return this.holdings;
  }

  listTransactions(): Transaction[] {
    return this.transactions.map((t) => ({ ...t }));
  }

  /** A JSON string of the account plus total value and profit/loss; also adds a point to the value time series. */
  async report(): Promise<string> {
    const portfolioValue = await this.calculatePortfolioValue();
    this.portfolio_value_time_series.push([timestampNow(), portfolioValue]);
    this.save();
    const pnl = this.calculateProfitLoss(portfolioValue);
    const data = { ...this.data(), total_portfolio_value: portfolioValue, total_profit_loss: pnl };
    writeLog(this.name, "account", "Retrieved account details");
    return JSON.stringify(data);
  }

  getStrategy(): string {
    writeLog(this.name, "account", "Retrieved strategy");
    return this.strategy;
  }

  /** At your discretion, if you choose to, call this to change your investment strategy for the future. */
  changeStrategy(strategy: string): string {
    this.strategy = strategy;
    this.save();
    writeLog(this.name, "account", "Changed strategy");
    return "Changed strategy";
  }
}
