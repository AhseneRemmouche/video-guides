// Week 6 product pricer: paste a product description, get an estimated price.
// The React front end posts the description to the Hono /api/price endpoint and
// shows the returned dollar amount, big.
import { useState } from "react";

const SAMPLE_DESCRIPTION =
  "Quadcast USB condenser microphone with tap-to-mute sensor, built-in " +
  "anti-vibration shock mount, and RGB lighting. Ideal for streaming, " +
  "podcasting, and gaming.";

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function App() {
  const [description, setDescription] = useState(SAMPLE_DESCRIPTION);
  const [price, setPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function estimate() {
    if (!description.trim() || busy) return;
    setBusy(true);
    setError("");
    setPrice(null);

    try {
      const res = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setPrice(typeof data.price === "number" ? data.price : null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <header>
        <h1>LLM Engineering - Week 6</h1>
        <p className="sub">
          The product pricer. Describe an item and a fine-tuned model estimates
          what it costs.
        </p>
      </header>

      <section className="card">
        <label className="field">
          Product description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            spellCheck={false}
            rows={6}
            placeholder="Describe the product you want a price for..."
          />
        </label>

        <button onClick={estimate} disabled={busy || !description.trim()}>
          {busy ? "Estimating..." : "Estimate price"}
        </button>

        {error && <div className="error">{error}</div>}

        {price !== null && (
          <div className="result">
            <div className="result-label">Estimated price</div>
            <div className="result-price">{formatPrice(price)}</div>
          </div>
        )}
      </section>
    </main>
  );
}
