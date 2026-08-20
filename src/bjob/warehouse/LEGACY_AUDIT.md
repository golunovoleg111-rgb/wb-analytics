# Legacy FBS audit — migration contract

## 1. Current dependency chain

```text
app/router
  -> FBS route
    -> fbsWarehouseScreen.js
      -> fbsWarehouseV3.js
        -> fbsWarehouseV2.js
          -> localStorage: bjob:fbs:v2
```

`fbsWarehouseScreen.js` is currently doing too much: persistence, rendering, drawing tools, dialogs, drag/drop, zoom, zone operations, box operations and route interaction. It imports the V3 layer directly. The screen therefore cannot become the new canonical implementation.

`fbsWarehouseV3.js` is a compatibility/enhancement layer over V2. It owns `designLocked`, normalization and `removeZone`, while re-exporting most V2 operations. This is exactly the pattern that the new architecture must eliminate.

`fbsWarehouseV2.js` currently owns warehouse, geometry, zones, boxes, inventory and assembly-task state in one object. It is useful as a migration source, but it is not the target domain model.

## 2. Migration disposition

| Legacy component | Decision | Reason |
|---|---|---|
| `fbsWarehouseV2.js` | MIGRATE -> DELETE | Source format for migration only; mixed responsibilities and obsolete geometry model |
| `fbsWarehouseV3.js` | DELETE | Enhancement layer over V2; `designLocked` is not an authorization boundary |
| `fbsWarehouseScreen.js` | REWRITE -> DELETE | UI, storage, geometry and business logic are coupled |
| `bjob:fbs:v2` | BRIDGE -> MIGRATE -> RETIRE | Existing user data must survive; new code must not write it |
| `warehouse/domain.js` | KEEP | Canonical pure domain contract introduced by PR #89 |
| `warehouse/layoutRepository.js` | KEEP / EXTEND | Draft/published layout persistence boundary; must later move away from direct localStorage if a DB repository is available |
| `accessModel.js` | KEEP / EXTEND | Existing application role model; warehouse permissions must be mapped here, not duplicated in FBS |
| `userAuth.js` | KEEP | Existing session and authorization source |
| `authGuard.js` | KEEP / HARDEN | Route guard only; it is not sufficient for warehouse mutations |

## 3. Canonical ownership after migration

### Domain

`src/bjob/warehouse/domain.js`

Owns only warehouse concepts and invariants. It must not import DOM, router, storage or UI modules.

### Repository

`src/bjob/warehouse/layoutRepository.js`

Owns persistence/versioning of layouts. The editor/viewer never write localStorage directly.

### Editor

Owns draft editing and geometry interactions. Every mutation must require an explicit warehouse edit permission.

### Viewer

Read-only. It renders only the published layout. Picker has no editor actions.

### Assembly overlay

Reads the published layout and current assembly state. It highlights required zones and produces the picker roadmap. It does not mutate the layout.

## 4. Role boundary

The existing application role model currently grants the `picker` role `view` and `edit` actions for the `fbs` section. This MUST NOT be interpreted as permission to edit warehouse layout.

The new warehouse permission namespace is separate:

- `warehouse.view`
- `warehouse.edit`
- `warehouse.publish`
- `warehouse.manageZones`
- `warehouse.manageGeometry`
- `warehouse.manageBoxes`
- `assembly.view`
- `assembly.execute`

Picker receives only:

- `warehouse.view`
- `assembly.view`
- `assembly.execute`

The existing `fbs.edit` section permission must not grant `warehouse.edit` implicitly.

## 5. Security rule

Hiding editor buttons is not authorization. Every domain command exposed by the new editor must verify the caller's warehouse permission before mutating state.

The eventual Viewer must not import editor commands. The picker UI should therefore have no route to the editor command module in the first place.

## 6. Layout lifecycle

```text
DRAFT
  -> VALIDATING
  -> PUBLISHED
  -> ARCHIVED
```

Operational screens and warehouse displays consume only `PUBLISHED` layout. Editing always happens against a draft. Publishing creates a new immutable operational snapshot and archives the previous published snapshot.

## 7. Legacy data migration

Migration must be explicit and one-way:

```text
bjob:fbs:v2
   -> read/validate
   -> convert walls/features/zones/boxes/tasks
   -> canonical warehouse layout + operational entities
   -> verification report
   -> mark migration complete
   -> stop writing bjob:fbs:v2
```

The migration must preserve:

- warehouse identity and name;
- wall/entrance coordinates;
- zones and their names/positions;
- boxes and QR identifiers;
- box contents;
- locked state;
- unassigned boxes (`zoneId = null`);
- assembly tasks/roadmaps where compatible.

Legacy `capacity` values cannot be blindly copied as the new zone capacity because the canonical model derives capacity from `rows × columns`. If legacy dimensions do not provide enough information to infer rows/columns, migration must use an explicit migration rule and record the result for review.

## 8. Geometry migration

Legacy walls use `{x1,y1,x2,y2,type}`. Canonical walls use explicit `{start,end,thickness,connections}`.

Legacy `features` are heterogeneous rectangles. They must NOT be copied wholesale into the new model. Each feature type must be classified:

- `window` -> opening/window;
- `route` -> direction/route overlay;
- `partition` -> wall(s), where geometry permits;
- `rect` -> four connected walls;
- unknown -> migration warning, not silent conversion.

This prevents the old "everything is a rectangle feature" problem from entering the new editor.

## 9. Removal rule

When the replacement implementation is complete, the legacy implementation is deleted in the same migration series. Do not keep `V4`, `FixV84`, `EnhancementV2` or similar parallel behavior as a permanent compatibility layer.

Temporary migration code must have an explicit retirement condition.
