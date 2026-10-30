"""Generate a small synthetic product-pricing dataset.

This stands in for Ed Donner's Week 6 Amazon "items_full" dataset, which is far
too large to reproduce offline. Each row is a templated product "description"
mentioning a category, a brand and a size, and a price that is a (noisy)
function of those three features. We write train/test CSVs to data/.
"""

import os
import random

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(HERE), "data")

SEED = 42

# Each category has a base price. Brands and sizes are multipliers/addends.
CATEGORIES = {
    "laptop": 900.0,
    "headphones": 120.0,
    "coffee maker": 80.0,
    "office chair": 180.0,
    "backpack": 45.0,
    "smartphone": 650.0,
    "monitor": 220.0,
    "blender": 60.0,
}

# Brand quality multiplier (premium brands cost more).
BRANDS = {
    "Acme": 0.8,
    "Globex": 1.0,
    "Initech": 1.15,
    "Umbrella": 1.4,
    "Stark": 1.8,
}

# Size adds a flat amount (bigger/pro variants cost more).
SIZES = {
    "mini": -20.0,
    "standard": 0.0,
    "large": 40.0,
    "pro": 120.0,
}

TEMPLATES = [
    "{brand} {size} {category} in excellent condition, barely used.",
    "Brand new {brand} {category} ({size} model) with full warranty.",
    "{size} {category} by {brand}. Great value, ships fast.",
    "Refurbished {brand} {category}, {size} edition, works perfectly.",
    "{brand} {category} {size} - a reliable everyday choice for home or office.",
]


def make_row(rng: random.Random):
    category = rng.choice(list(CATEGORIES))
    brand = rng.choice(list(BRANDS))
    size = rng.choice(list(SIZES))
    template = rng.choice(TEMPLATES)

    description = template.format(brand=brand, size=size, category=category)

    base = CATEGORIES[category]
    price = base * BRANDS[brand] + SIZES[size]
    # Multiplicative + additive noise so the relationship is learnable but not exact.
    price *= rng.uniform(0.9, 1.1)
    price += rng.gauss(0, 8)
    price = max(5.0, round(price, 2))

    return {
        "description": description,
        "category": category,
        "brand": brand,
        "size": size,
        "price": price,
    }


def main():
    rng = random.Random(SEED)
    np.random.seed(SEED)

    n = 300
    rows = [make_row(rng) for _ in range(n)]
    df = pd.DataFrame(rows)

    # Shuffle and split 80/20 train/test.
    df = df.sample(frac=1.0, random_state=SEED).reset_index(drop=True)
    split = int(len(df) * 0.8)
    train_df = df.iloc[:split].reset_index(drop=True)
    test_df = df.iloc[split:].reset_index(drop=True)

    os.makedirs(DATA_DIR, exist_ok=True)
    train_path = os.path.join(DATA_DIR, "train.csv")
    test_path = os.path.join(DATA_DIR, "test.csv")
    train_df.to_csv(train_path, index=False)
    test_df.to_csv(test_path, index=False)

    print("Synthetic product dataset generated.")
    print(f"  total rows : {len(df)}")
    print(f"  train rows : {len(train_df)}  -> {train_path}")
    print(f"  test rows  : {len(test_df)}  -> {test_path}")
    print(f"  price range: ${df['price'].min():.2f} - ${df['price'].max():.2f}")
    print(f"  mean price : ${df['price'].mean():.2f}")
    print()
    print("Sample rows:")
    print(train_df.head(3).to_string(index=False))


if __name__ == "__main__":
    main()
