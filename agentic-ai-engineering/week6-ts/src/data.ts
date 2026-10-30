// Static DEMO data for the Week 6 portfolio UI.
// These are representative, made-up numbers — NOT real market data and NOT
// connected to the Python accounts MCP server. They mirror the SHAPE of the
// trading-floor account (cash + holdings + recent trades) so the UI has
// something realistic to show.

export interface Holding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number; // what we paid per share, on average
  price: number; // current (demo) price per share
}

export interface Trade {
  time: string;
  side: "BUY" | "SELL";
  symbol: string;
  shares: number;
  price: number;
}

export const trader = {
  name: "Ava",
  strategy: "Balanced growth — large-cap tech, trimmed on strength.",
};

export const cash = 2415.6;

export const holdings: Holding[] = [
  { symbol: "AAPL", name: "Apple Inc.", shares: 18, avgCost: 176.4, price: 190.0 },
  { symbol: "MSFT", name: "Microsoft Corp.", shares: 7, avgCost: 395.1, price: 410.0 },
  { symbol: "NVDA", name: "NVIDIA Corp.", shares: 22, avgCost: 118.75, price: 130.0 },
  { symbol: "AMZN", name: "Amazon.com Inc.", shares: 11, avgCost: 171.2, price: 185.0 },
];

export const recentTrades: Trade[] = [
  { time: "09:32", side: "BUY", symbol: "NVDA", shares: 5, price: 129.4 },
  { time: "10:05", side: "SELL", symbol: "AAPL", shares: 4, price: 191.2 },
  { time: "11:18", side: "BUY", symbol: "MSFT", shares: 2, price: 409.3 },
  { time: "13:47", side: "BUY", symbol: "AMZN", shares: 3, price: 184.1 },
];
