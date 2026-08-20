# Warehouse architecture

## Boundaries

The warehouse system has three explicit consumers:

- **Editor** — creates and modifies a draft layout. Requires warehouse edit permissions.
- **Viewer** — read-only rendering of the published layout. Pickers use this mode.
- **Assembly** — overlays current assembly tasks and routes on top of the published layout. It does not mutate the layout.

A picker must never receive editor controls merely hidden by CSS. Permission checks are part of the domain boundary and must be applied before editor actions are exposed or executed.

## Layout lifecycle

```text
DRAFT -> VALIDATING -> PUBLISHED -> ARCHIVED
```

The editor works on a draft. The operational warehouse map uses only the published version. Publishing archives the previous published version instead of mutating it in place.

## Geometry rules

Walls are connected geometric objects with explicit endpoints and connection lists. A rectangle is a tool for creating four connected walls, not a separate persistent geometry primitive. Windows and doors are openings, not generic rectangles. Directions are independent route-overlay objects.

## Zones

Zone capacity is derived from `rows * columns`. Boxes have an explicit `zoneId`, `row` and `position`. A box with `zoneId = null` is a valid unassigned state and must be handled by a dedicated assignment UI, not rendered as a loose object at the top of the canvas.

## Cleanup rule

Do not add another enhancement/fix layer to override warehouse behavior. A changed tool or model must have one canonical implementation. Obsolete implementations are removed as part of the same migration.
