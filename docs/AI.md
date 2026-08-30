# AI architecture

The platform separates **detection** ("what looks abnormal?") from **decision** ("what
should we do?"). Detectors emit scores; the fuzzy engine + business rules turn scores into
a severity, an explanation, and a recommended action.

All outputs share one contract (`AiResult`), so a Python/FastAPI service can replace the
built-in TypeScript layer without backend changes — set `AI_SERVICE_URL`.

```json
{
  "score": 78,
  "severity": "HIGH",
  "confidence": 0.9,
  "explanation": ["Temperature is above the safe operating range."],
  "recommended_action": "Ask the rider to return the vehicle and inspect the battery.",
  "technical": { "recentTemp": 58.2, "voltDropPerStep": 0.3 }
}
```

## Detectors

### Battery anomaly (`batteryAnomaly`)
- **Intended model:** GRU/LSTM autoencoder over 30–60-point windows; reconstruction error
  = anomaly score.
- **Here:** an interpretable "reconstruction error" — deviation of recent points from a
  smoothed baseline (EWMA) + temperature-rise / voltage-drop slopes + a **sustained
  physical-severity floor** (a battery plateaued at a dangerous temperature stays
  high-risk even when the rate of change flattens).

### Battery fault (`batteryFault`)
- **Intended:** LSTM / temporal-transformer classifier.
- **Here:** weighted decision over engineered features → a **hedged** label ("likely
  overheating"), never a certainty.

### Battery SOH (`batterySoh`) & RUL (`batteryRul`)
- **Intended:** XGBoost/LightGBM (SOH), temporal transformer (RUL).
- **Here:** transparent weighted-feature model (cycles, age, thermal history, voltage
  instability, anomaly history) → 0–100 %, plus a probabilistic cycle **range** with
  confidence — no false precision.

### Theft / unauthorized movement (`theftRisk`)
- **Intended:** trajectory transformer + anomaly detection.
- **Here:** behavioural model — rental violation + distance beyond the expected zone +
  outbound motion (moving *away*) + trajectory irregularity (bearing variance). Output is
  a risk with confidence; the label is "possible unauthorized movement", never "stolen".

### Tampering (`tamperingRisk`)
- **Intended:** multivariate GRU/LSTM autoencoder over sensor-consistency signals.
- **Here:** consistency/contradiction model — a moving vehicle should keep producing GPS +
  BLE + telemetry; simultaneous signal loss while in motion is the strongest indicator.

## Robust BLE / RF mitigation (`robustEstimate`)

BLE RSSI is noisy (metal reflection, multipath, urban interference). We never trust a
single reading: multiple samples → **modified z-score** outlier removal (MAD) → **median**
of the clean set → **stability** → confidence band (HIGH/MEDIUM/LOW). Example: `[-48, -50,
-49, -85, -51]` → outlier `-85` removed → estimate ≈ `-49.5`, confidence HIGH. The UI
shows "Signal confidence: Medium", not "−72 dBm".

## Fuzzy decision layer (`fuzzyDecision`)

Trapezoidal/triangular membership functions map each 0–100 score into LOW/MEDIUM/HIGH/
CRITICAL degrees. A small rule base fires (e.g. *rental EXPIRED ∧ movement HIGH ∧ zone
breach ⇒ theft CRITICAL*), we defuzzify with a weighted centroid, and dampen gently by the
**dominant** signal's confidence (a low-confidence theft reading must not mute a
high-confidence battery-critical alert). The engine also returns the **driver** so the
incident is titled and explained correctly.

## Safety & explainability

- Never overpromises: risk, probability, anomaly, confidence — supporting a human, not
  replacing them.
- Every alert lists contributing factors and exposes raw scores behind a "Why?" panel.
- Low confidence is surfaced, not hidden.
- On external-AI failure, the backend falls back to the local engine.

## ML pipeline (for the real models)

`ml/` sketches a reproducible pipeline: synthetic telemetry generator (healthy / aging /
overheating / voltage-instability / normal & abnormal trajectories / GPS-BLE loss /
tampering) → cleaning → feature engineering → **time-aware** split (no leakage) → train →
evaluate (battery: precision/recall/F1/ROC-AUC/FPR; SOH: MAE/RMSE/R²; RUL: MAE + interval)
→ serialize + version (`battery_anomaly_v1`, `battery_soh_v1`, …) → serve behind
`AI_SERVICE_URL`. Synthetic training data is kept clearly distinct from real production
telemetry so real history can replace it later.
