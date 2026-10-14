// A tiny logger that prints "time | LEVEL | message", like the course's
// logging.basicConfig(format="%(asctime)s | %(levelname)s | %(message)s").
function stamp() {
  const now = new Date();
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())},${pad(now.getMilliseconds(), 3)}`;
  return `${date} ${time}`;
}

export const log = {
  info: (message: string) => console.error(`${stamp()} | INFO | ${message}`),
  warning: (message: string) => console.error(`${stamp()} | WARNING | ${message}`),
};
