"""Traditional ML baselines for the synthetic product pricer.

Mirrors Ed Donner's Week 6 "day 3" baselines:
  - a constant predictor (always predict the training mean),
  - a CountVectorizer + LinearRegression over the description text,
  - a RandomForestRegressor over the same bag-of-words features.

Each model is scored on the held-out test set with Average Absolute Error
(mean |predicted - actual| in dollars), the same spirit as the course's metric.
Results are printed as a small leaderboard and also saved to data/baseline_preds.csv
so frontier_eval.py can print the local LLM number next to these.
"""

import os

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LinearRegression

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(HERE), "data")

SEED = 42


def average_absolute_error(y_true, y_pred):
    return float(np.mean(np.abs(np.asarray(y_pred) - np.asarray(y_true))))


def load_data():
    train = pd.read_csv(os.path.join(DATA_DIR, "train.csv"))
    test = pd.read_csv(os.path.join(DATA_DIR, "test.csv"))
    return train, test


def main():
    train, test = load_data()
    print(f"Loaded {len(train)} train / {len(test)} test items\n")

    y_train = train["price"].to_numpy()
    y_test = test["price"].to_numpy()

    results = []  # (name, avg_abs_error)

    # --- Baseline 1: constant (mean) predictor -------------------------------
    mean_price = float(np.mean(y_train))
    const_pred = np.full(len(test), mean_price)
    results.append(("Constant (mean) predictor", average_absolute_error(y_test, const_pred)))

    # --- Baseline 2: CountVectorizer + LinearRegression ----------------------
    np.random.seed(SEED)
    vectorizer = CountVectorizer(max_features=2000, stop_words="english")
    X_train = vectorizer.fit_transform(train["description"])
    X_test = vectorizer.transform(test["description"])

    lin = LinearRegression()
    lin.fit(X_train, y_train)
    lin_pred = np.maximum(lin.predict(X_test), 0)
    results.append(("CountVectorizer + LinearRegression", average_absolute_error(y_test, lin_pred)))

    # --- Baseline 3: RandomForestRegressor -----------------------------------
    rf = RandomForestRegressor(n_estimators=200, random_state=SEED, n_jobs=-1)
    rf.fit(X_train, y_train)
    rf_pred = np.maximum(rf.predict(X_test), 0)
    results.append(("RandomForestRegressor (bag-of-words)", average_absolute_error(y_test, rf_pred)))

    # --- Leaderboard ---------------------------------------------------------
    results.sort(key=lambda r: r[1])
    print("Baseline leaderboard (Average Absolute Error, lower is better):")
    print("-" * 56)
    for name, err in results:
        print(f"  ${err:8.2f}   {name}")
    print("-" * 56)
    print(f"  (training mean price = ${mean_price:.2f})")

    # Persist test predictions + errors so frontier_eval can line up with these.
    out = pd.DataFrame(
        {
            "description": test["description"],
            "actual": y_test,
            "const_pred": const_pred,
            "linreg_pred": lin_pred,
            "rf_pred": rf_pred,
        }
    )
    out_path = os.path.join(DATA_DIR, "baseline_preds.csv")
    out.to_csv(out_path, index=False)

    summary = pd.DataFrame(results, columns=["model", "avg_abs_error"])
    summary.to_csv(os.path.join(DATA_DIR, "baseline_scores.csv"), index=False)
    print(f"\nSaved per-item predictions -> {out_path}")


if __name__ == "__main__":
    main()
