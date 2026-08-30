# ML pipeline (path to the real models)

The running app uses the interpretable TypeScript AI layer (`src/lib/ai/`). This folder is
the **reproducible pipeline** for training the neural/gradient-boosted models the spec
describes, which then serve behind `AI_SERVICE_URL` with the same JSON contract.

## Steps

```
generate_synthetic.py   →  data/*.csv   (labelled synthetic telemetry)
train.py                →  models/*     (serialized, versioned)
serve.py (sketch)       →  FastAPI /predict/* endpoints
```

1. **`generate_synthetic.py`** — pure-stdlib generator (runs with no dependencies).
   Produces battery sequences (healthy / aging / overheating / voltage-instability /
   rapid-discharge) and movement sequences (normal / suspicious / GPS-BLE loss /
   tampering), clearly labelled. **Synthetic training data is kept distinct from real
   production telemetry** so real history can replace it later.

   ```bash
   python3 ml/generate_synthetic.py --out ml/data --n 400
   ```

2. **`train.py`** (documented sketch, needs `scikit-learn`/`xgboost`/`torch`) — cleaning →
   feature engineering → normalization → sequence windows → **time-aware** split (no
   leakage) → train → evaluate → serialize + version.

   Target models & metrics:
   - Battery anomaly: GRU/LSTM autoencoder — precision / recall / F1 / ROC-AUC / FPR.
   - Battery fault: LSTM / temporal-transformer classifier.
   - Battery SOH: XGBoost/LightGBM — MAE / RMSE / R².
   - Battery RUL: temporal transformer — MAE/RMSE + uncertainty interval.
   - Theft: trajectory transformer + anomaly detection — precision / recall / false-alert rate.
   - Tampering: multivariate GRU/LSTM autoencoder.

3. **`serve.py`** — FastAPI exposing `/predict/{battery-anomaly,battery-health,
   battery-fault,theft-risk,tampering,risk-fusion}` returning the shared `AiResult` JSON.
   Point the Next backend at it with `AI_SERVICE_URL=http://localhost:8000`.

## Model management
Models are versioned (`battery_anomaly_v1`, `battery_soh_v1`, …) and loaded once at
service start, never retrained per request. A metadata record tracks version + metrics.
