"""Note about the parts of the real Week 8 system NOT run here."""

NOTE = """
================================================================
Week 8 - autonomous deal-hunting agent system: what is STUBBED
================================================================

This local project verifies the AGENT LOGIC only (scan -> price -> rank
-> alert) against a local Ollama model with sample data. Three pieces of
the real Ed Donner Week 8 system are NOT run here:

1. PRICER on MODAL
   The real specialist pricer is a fine-tuned LLM (Llama-based) deployed
   as a serverless Modal app ("pricer-service" / class "Pricer"), called
   with pricer.price.remote(description). It is part of an EnsembleAgent
   with a frontier RAG pricer and a neural-network agent.
   -> Here it is replaced by one short call to local Ollama.

2. SCANNER + live RSS feeds
   The real ScannerAgent fetches deals from live RSS deal feeds and uses a
   frontier model with structured output to select promising ones.
   -> Here it is replaced by a small hard-coded sample list (deals.py).

3. PUSHOVER alerts
   The real messaging agent sends a push notification via Pushover
   (PUSHOVER_USER / PUSHOVER_TOKEN).
   -> Here messaging_agent_alert() just PRINTS the alert (a no-op stub).

None of Modal, RSS, or Pushover is contacted by this project.
================================================================
"""

if __name__ == "__main__":
    print(NOTE)
