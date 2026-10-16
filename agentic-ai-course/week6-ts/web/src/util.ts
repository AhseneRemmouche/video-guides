// Port of 6_mcp/util.py (the colour part) and app.py's mapper: which colour each log type gets in the log panel.
// The CSS and the "force dark theme" JavaScript from util.py live in styles.css instead.
export const Color = {
  RED: "#dd0000",
  GREEN: "#00dd00",
  YELLOW: "#dddd00",
  BLUE: "#0000ee",
  MAGENTA: "#aa00dd",
  CYAN: "#00dddd",
  WHITE: "#87CEEB",
} as const;

export const mapper: Record<string, string> = {
  trace: Color.WHITE,
  agent: Color.CYAN,
  function: Color.GREEN,
  generation: Color.YELLOW,
  response: Color.MAGENTA,
  account: Color.RED,
};

export const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
