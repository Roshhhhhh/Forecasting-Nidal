---
name: Monthly projection row ID instability
description: Monthly projection rows are deleted and reinserted on every recalculate — row IDs change; use month number (1–12) as the stable key.
---

# Monthly projection row ID instability

The `POST /forecasts/:id/calculate` endpoint deletes ALL rows from `monthly_projections` for the forecast and reinserts them. This means **row `id` values change every time recalculate runs**.

**Why:** The calculate logic outputs a fresh set of 12 rows; wiping + reinserting was the simplest way to keep the table consistent.

**How to apply:**
- Any endpoint that targets a specific month must use `forecastId + month` (1–12) as the WHERE clause, NOT the row `id`.
- The `PATCH /forecasts/:id/monthly/:monthNum` endpoint correctly uses `monthNum` (1–12).
- Frontend state keys (editing, saving maps) must also be keyed by `m.month`, not `m.id`.
- If a future feature needs stable row references, consider a separate `monthly_overrides` table keyed by `(forecast_id, month)` rather than the projection rows themselves.
