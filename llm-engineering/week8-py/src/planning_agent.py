"""Planning agent: the end-to-end deal-hunting loop over the sample deals.

Mirrors the real Week 8 AutonomousPlanningAgent, but offline:
  1. scan   -> get deals (sample list, stands in for ScannerAgent + RSS)
  2. price  -> estimate each deal's fair value with the local Ollama pricer
  3. rank   -> discount = estimate - actual_price; sort best first
  4. alert  -> messaging_agent.alert() PRINTS (stub for Pushover push)

Run: uv run python src/planning_agent.py
"""

from dataclasses import dataclass

try:
    from deals import Deal, scan_for_deals
    from pricer_agent import estimate_price
except ImportError:  # when run as a module
    from src.deals import Deal, scan_for_deals
    from src.pricer_agent import estimate_price


@dataclass
class Opportunity:
    deal: Deal
    estimate: float
    discount: float


def messaging_agent_alert(opp: Opportunity) -> None:
    """Stub for the Pushover messaging agent: just PRINT the alert."""
    print("=" * 60)
    print("[messaging_agent] PUSH ALERT (stub for Pushover)")
    print(f"  Deal:     {opp.deal.title}")
    print(f"  Price:    ${opp.deal.actual_price:.2f}")
    print(f"  Estimate: ${opp.estimate:.2f}")
    print(f"  Discount: ${opp.discount:.2f}")
    print(f"  URL:      {opp.deal.url}")
    print("=" * 60)


def plan() -> list[Opportunity]:
    """Scan -> price -> rank -> alert over the sample deals."""
    print("[planning_agent] Scanning for deals (sample data stands in for RSS scanner)...")
    deals = scan_for_deals()
    print(f"[planning_agent] Got {len(deals)} deals. Pricing each via local Ollama...\n")

    opportunities: list[Opportunity] = []
    for i, deal in enumerate(deals, 1):
        print(f"  ({i}/{len(deals)}) pricing: {deal.title} ...")
        estimate = estimate_price(deal.description)
        discount = estimate - deal.actual_price
        opportunities.append(Opportunity(deal=deal, estimate=estimate, discount=discount))
        print(f"      actual=${deal.actual_price:.2f}  estimate=${estimate:.2f}  discount=${discount:.2f}")

    opportunities.sort(key=lambda o: o.discount, reverse=True)

    print("\n[planning_agent] Ranked opportunities (biggest discount first):")
    print(f"{'rank':<5}{'discount':>12}{'estimate':>12}{'actual':>12}  title")
    for rank, opp in enumerate(opportunities, 1):
        print(
            f"{rank:<5}{opp.discount:>12.2f}{opp.estimate:>12.2f}"
            f"{opp.deal.actual_price:>12.2f}  {opp.deal.title}"
        )

    if opportunities:
        best = opportunities[0]
        print("\n[planning_agent] Best opportunity -> sending alert:\n")
        messaging_agent_alert(best)

    return opportunities


if __name__ == "__main__":
    plan()
