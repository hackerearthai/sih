# SIH26190 — AI Module (Pre-Upload Gatekeeper)

Standalone Flask microservice that screens a document **once, at upload
time, before its hash is written to the blockchain**. It flags documents
that look like they were already edited/faked before reaching the system.
It never auto-rejects — it only returns `aiRiskFlag` for a human reviewer.

It does **not** do any blockchain hash comparison — that lives in the
backend's separate verify endpoint.

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Runs on `http://0.0.0.0:6000`. CORS is restricted to `http://localhost:5000`
(only the backend calls this directly). Override with the `ALLOWED_ORIGIN`
env var if your backend runs elsewhere.

## Configuration (env vars)

| Variable             | Default                | Purpose                                   |
|-----------------------|------------------------|--------------------------------------------|
| `ELA_SCORE_THRESHOLD` | `40`                   | ELA score above which review is triggered  |
| `ELA_JPEG_QUALITY`    | `90`                   | Re-save quality used for ELA               |
| `ELA_HEATMAP_DIR`     | `ela_heatmaps`         | Where heatmap PNGs are saved               |
| `ALLOWED_ORIGIN`      | `http://localhost:5000`| CORS-allowed origin (the backend)          |

## Endpoints

- `GET /health` — sanity check
- `POST /analyze` — multipart form field `file` (JPEG/PNG image, or PDF —
  first page is rendered to an image for ELA; PDF metadata is checked
  directly). Response:

```json
{
  "aiRiskFlag": "clean",
  "details": {
    "elaScore": 12.4,
    "metadataFlags": [],
    "elaHeatmapPath": "ela_heatmaps/....png"
  }
}
```

## Demo test script

```bash
python test_script.py path/to/unedited.jpg path/to/edited.jpg
```

Posts both files to the running service and prints results side by side,
so you can confirm `elaScore` and `metadataFlags` are clearly different
between a genuine photo and a doctored one before demo day.

## Notes for the panel

This check happens once, at upload. Its only job is to flag suspicious
documents for human review before they get locked into the blockchain as
"the original." It does not, and does not try to, catch tampering after
that point — that's the blockchain's job via hash comparison in the
backend's verify endpoint. False positives here are expected and
acceptable (e.g. a scanned page with sharp text edges can trigger a higher
ELA score); false confidence is not — hence no auto-reject, ever.
