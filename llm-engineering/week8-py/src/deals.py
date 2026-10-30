"""Sample "scanned" deals.

In the real Week 8 system a ScannerAgent fetches these from live RSS deal
feeds (dealnews.com etc.) and uses a frontier model to pick the most
promising ones, returning a structured list. Here we hard-code a small sample
so the agent pipeline (scan -> price -> rank -> alert) can be verified offline.

Each deal has:
  title          - short product name
  description    - the text a pricer agent estimates a fair value from
  actual_price   - the price the deal is offered at (what the scanner found)
  url            - the deal link (fake, for display only)
"""

from dataclasses import dataclass


@dataclass
class Deal:
    title: str
    description: str
    actual_price: float
    url: str


# A real ScannerAgent would produce this list from RSS feeds.
SAMPLE_DEALS: list[Deal] = [
    Deal(
        title="Sony WH-1000XM5 Wireless Headphones",
        description="Sony WH-1000XM5 over-ear wireless noise-cancelling headphones with 30-hour battery life, Bluetooth multipoint, and premium sound. Brand new, sealed.",
        actual_price=248.0,
        url="https://example.com/deal/sony-xm5",
    ),
    Deal(
        title="Ninja Air Fryer 4-Quart",
        description="Ninja AF101 4-quart air fryer, 1550 watts, with crisper plate and nonstick basket for low-fat frying, roasting, and reheating.",
        actual_price=79.0,
        url="https://example.com/deal/ninja-af101",
    ),
    Deal(
        title="DeWalt 20V Cordless Drill Kit",
        description="DeWalt DCD777C2 20V MAX brushless cordless drill/driver kit with two 1.3Ah batteries, charger, and carrying bag.",
        actual_price=99.0,
        url="https://example.com/deal/dewalt-dcd777",
    ),
    Deal(
        title="Samsung 50-inch 4K Smart TV",
        description="Samsung 50-inch Class Crystal UHD 4K smart TV with HDR, built-in Alexa, and Tizen apps. 2024 model.",
        actual_price=329.0,
        url="https://example.com/deal/samsung-50-4k",
    ),
    Deal(
        title="Logitech MX Master 3S Mouse",
        description="Logitech MX Master 3S wireless performance mouse, 8000 DPI, quiet clicks, USB-C fast charging, works on glass.",
        actual_price=72.0,
        url="https://example.com/deal/logitech-mx3s",
    ),
    Deal(
        title="Instant Pot Duo 6-Quart",
        description="Instant Pot Duo 7-in-1 electric pressure cooker, 6 quart, slow cooker, rice cooker, steamer, saute, and warmer.",
        actual_price=59.0,
        url="https://example.com/deal/instant-pot-duo",
    ),
]


def scan_for_deals() -> list[Deal]:
    """Stand-in for ScannerAgent.scan(): returns the sample deals."""
    return SAMPLE_DEALS
