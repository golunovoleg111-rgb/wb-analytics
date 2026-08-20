/**
 * Canonical warehouse domain model.
 *
 * This module is intentionally pure: no DOM, localStorage, rendering or role UI.
 * It defines the contract shared by the editor, read-only viewer and assembly map.
 */

export const LAYOUT_STATUS = Object.freeze({
  DRAFT: 'draft',
  VALIDATING: 'validating',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
});

export const OBJECT_TYPES = Object.freeze({
  WALL: 'wall',
  ROOM: 'room',
  WINDOW: 'window',
  DOOR: 'door',
  DIRECTION: 'direction',
  ZONE: 'zone'
});

export const PERMISSIONS = Object.freeze({
  WAREHOUSE_VIEW: 'warehouse.view',
  WAREHOUSE_EDIT: 'warehouse.edit',
  WAREHOUSE_PUBLISH: 'warehouse.publish',
  WAREHOUSE_MANAGE_ZONES: 'warehouse.manageZones',
  WAREHOUSE_MANAGE_GEOMETRY: 'warehouse.manageGeometry',
  WAREHOUSE_MANAGE_BOXES: 'warehouse.manageBoxes',
  ASSEMBLY_VIEW: 'assembly.view',
  ASSEMBLY_EXECUTE: 'assembly.execute'
});

export const ROLE_PERMISSIONS = Object.freeze({
  admin: Object.freeze(Object.values(PERMISSIONS)),
  manager: Object.freeze([
    PERMISSIONS.WAREHOUSE_VIEW,
    PERMISSIONS.WAREHOUSE_EDIT,
    PERMISSIONS.WAREHOUSE_PUBLISH,
    PERMISSIONS.WAREHOUSE_MANAGE_ZONES,
    PERMISSIONS.WAREHOUSE_MANAGE_GEOMETRY,
    PERMISSIONS.WAREHOUSE_MANAGE_BOXES,
    PERMISSIONS.ASSEMBLY_VIEW,
    PERMISSIONS.ASSEMBLY_EXECUTE
  ]),
  picker: Object.freeze([
    PERMISSIONS.WAREHOUSE_VIEW,
    PERMISSIONS.ASSEMBLY_VIEW,
    PERMISSIONS.ASSEMBLY_EXECUTE
  ])
});

export function permissionsForRole(role) {
  return new Set(ROLE_PERMISSIONS[role] || []);
}

export function can(permission, role) {
  return permissionsForRole(role).has(permission);
}

export function createLayout({ id, warehouseId, version = 1, status = LAYOUT_STATUS.DRAFT } = {}) {
  return {
    id: id || crypto.randomUUID(),
    warehouseId: warehouseId || null,
    version,
    status,
    revision: 1,
    rooms: [],
    walls: [],
    openings: [],
    directions: [],
    zones: [],
    updatedAt: new Date().toISOString(),
    publishedAt: null
  };
}

export function createZone({ id, name, rows = 1, columns = 1, x = 0, y = 0, width = 240, height = 160 } = {}) {
  const safeRows = Math.max(1, Number(rows) || 1);
  const safeColumns = Math.max(1, Number(columns) || 1);
  return {
    id: id || crypto.randomUUID(),
    name: String(name || 'Новая зона').trim(),
    x: Number(x) || 0,
    y: Number(y) || 0,
    width: Math.max(80, Number(width) || 240),
    height: Math.max(80, Number(height) || 160),
    rows: safeRows,
    columns: safeColumns,
    capacity: safeRows * safeColumns,
    boxIds: []
  };
}

export function createWall({ id, start, end, thickness = 8 } = {}) {
  if (!start || !end) throw new Error('Wall requires start and end points');
  return {
    id: id || crypto.randomUUID(),
    start: { x: Number(start.x) || 0, y: Number(start.y) || 0 },
    end: { x: Number(end.x) || 0, y: Number(end.y) || 0 },
    thickness: Math.max(1, Number(thickness) || 8),
    connections: []
  };
}

export function createBox({ id, code, warehouseId = null, zoneId = null, row = null, position = null, contents = [] } = {}) {
  return {
    id: id || crypto.randomUUID(),
    code: String(code || '').trim(),
    warehouseId,
    zoneId,
    row,
    position,
    contents: Array.isArray(contents) ? contents : []
  };
}

export function zoneCapacity(zone) {
  if (!zone) return 0;
  const rows = Math.max(1, Number(zone.rows) || 1);
  const columns = Math.max(1, Number(zone.columns) || 1);
  return rows * columns;
}

export function zoneOccupancy(zone) {
  return Array.isArray(zone?.boxIds) ? zone.boxIds.length : 0;
}

export function canPlaceBox(zone) {
  return zoneOccupancy(zone) < zoneCapacity(zone);
}

export function normalizeLayout(layout) {
  const source = layout && typeof layout === 'object' ? layout : {};
  const normalized = {
    ...createLayout({
      id: source.id,
      warehouseId: source.warehouseId,
      version: source.version || 1,
      status: source.status || LAYOUT_STATUS.DRAFT
    }),
    ...source
  };
  for (const key of ['rooms', 'walls', 'openings', 'directions', 'zones']) {
    if (!Array.isArray(normalized[key])) normalized[key] = [];
  }
  normalized.zones = normalized.zones.map(zone => ({
    ...zone,
    rows: Math.max(1, Number(zone.rows) || 1),
    columns: Math.max(1, Number(zone.columns) || 1),
    boxIds: Array.isArray(zone.boxIds) ? [...new Set(zone.boxIds)] : []
  })).map(zone => ({ ...zone, capacity: zone.rows * zone.columns }));
  return normalized;
}
