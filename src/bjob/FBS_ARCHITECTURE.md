# FBS: single architecture

FBS is rebuilt as one domain and one UI flow. Legacy FBS modules must not be reintroduced as parallel bridges.

Canonical domain: `fbsWarehouseV2.js`.

Canonical flow: warehouse -> walls/zones/entrances -> box -> QR/content -> inventory -> scan/order validation -> move/lock/delete -> assembly task/ROADMAP -> shipment handoff.
