# B-JOB

Production architecture for the autonomous WB operations platform.

Domains: data import/API, products, analytics, warehouses, FBS, unit economics, production, advertising, reports, users and AI.

Rules:
- No demo records in production storage.
- Calculations are deterministic and data-first.
- UI never owns business calculations.
- Empty data is a valid state, not an error.
- API and import adapters normalize into the same domain model.
- Every write is auditable.
