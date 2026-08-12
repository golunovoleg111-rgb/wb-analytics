# B-JOB core

The core is intentionally independent from UI and storage. Business calculations, import contracts, WB API adapters, warehouse/FBS domain rules and reporting primitives live here.

## Rules
- No test/demo data is created by core modules.
- UI must call domain functions instead of duplicating calculations.
- WB credentials are passed only to the API adapter; they are never hard-coded.
- Decimal money values are preserved to two decimal places.
- Domain errors must be shown as actionable messages by the UI.
