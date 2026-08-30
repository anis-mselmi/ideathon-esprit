#!/usr/bin/env python3
"""
Training pipeline sketch (needs scikit-learn; xgboost/torch optional).

Demonstrates the reproducible flow: load → feature-engineer → TIME-AWARE split
(no leakage) → train → evaluate → serialize + version. The neural autoencoders /
transformers described in docs/AI.md slot into the same structure.

    pip install scikit-learn xgboost
    python3 ml/train.py --data ml/data --out ml/models
"""
import argparse
import csv
import json
import os
from collections import defaultdict


def load_sequences(path, value_cols):
    seqs = defaultdict(list)
    labels = {}
    with open(path) as f:
        for row in csv.DictReader(f):
            sid = int(row["seq_id"])
            seqs[sid].append([float(row[c]) for c in value_cols])
            labels[sid] = row["label"]
    return seqs, labels


def features(seq):
    """Window-level features (mean/std/slope/range) per channel — same engineered
    signals the TypeScript detectors use."""
    import statistics as st
    cols = list(zip(*seq))
    feats = []
    for ch in cols:
        n = len(ch)
        mean = sum(ch) / n
        std = st.pstdev(ch)
        slope = (ch[-1] - ch[0]) / max(1, n - 1)
        feats += [mean, std, slope, max(ch) - min(ch)]
    return feats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="ml/data")
    ap.add_argument("--out", default="ml/models")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.metrics import classification_report
        import joblib
    except ImportError:
        print("Install scikit-learn to run training: pip install scikit-learn")
        print("(generate_synthetic.py already produced the labelled data.)")
        return

    seqs, labels = load_sequences(
        os.path.join(args.data, "battery.csv"), ["temperature", "voltage", "soc"]
    )
    X, y, ids = [], [], sorted(seqs)
    for sid in ids:
        X.append(features(seqs[sid]))
        y.append(labels[sid])

    # Time-aware split: earlier sequence ids -> train, later -> test (no leakage).
    cut = int(len(X) * 0.8)
    Xtr, Xte, ytr, yte = X[:cut], X[cut:], y[:cut], y[cut:]

    clf = RandomForestClassifier(n_estimators=200, random_state=42)
    clf.fit(Xtr, ytr)
    print(classification_report(yte, clf.predict(Xte)))

    model_path = os.path.join(args.out, "battery_fault_v1.joblib")
    joblib.dump(clf, model_path)
    with open(os.path.join(args.out, "metadata.json"), "w") as f:
        json.dump({"battery_fault": {"version": "v1", "path": model_path}}, f, indent=2)
    print(f"Saved {model_path}")


if __name__ == "__main__":
    main()
