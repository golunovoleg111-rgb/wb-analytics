# B-JOB shared API

The server provides the persistent shared data API used by the frontend.

## Run

```bash
cd server
npm start
```

Default port: `8787`.

The same process serves both the frontend and `/api`, so the default frontend configuration needs no API URL.

## API

- `GET /api/health`
- `GET /api/{store}`
- `POST /api/{store}`
- `DELETE /api/{store}` — clears a store

Shared stores: products, sales, stocks, ads, expenses, fbs, settings, imports, warehouses, warehouseMoves, pallets, boxes, shipments, productionOrders, users, audit, fbsSpaces, fbsBoxes, stockMovements.

WB API connection credentials are deliberately **local-only** and are not exposed by the shared API.

If the API is deployed separately, set `window.__BJOB_API_BASE__` before the application modules load, for example:

```html
<script>window.__BJOB_API_BASE__='https://api.example.com'</script>
```

Do not put credentials or database secrets into the frontend. The server-side `data/` directory must be persistent in the deployment environment.
