import { PERMISSIONS, can, permissionsForRole } from './domain.js';

export function requirePermission(role, permission) {
  if (!can(permission, role)) throw new Error(`Недостаточно прав: ${permission}`);
  return true;
}

export function canViewWarehouse(role) { return can(PERMISSIONS.WAREHOUSE_VIEW, role); }
export function canEditWarehouse(role) { return can(PERMISSIONS.WAREHOUSE_EDIT, role); }
export function canPublishWarehouse(role) { return can(PERMISSIONS.WAREHOUSE_PUBLISH, role); }
export function canManageZones(role) { return can(PERMISSIONS.WAREHOUSE_MANAGE_ZONES, role); }
export function canManageGeometry(role) { return can(PERMISSIONS.WAREHOUSE_MANAGE_GEOMETRY, role); }
export function canManageBoxes(role) { return can(PERMISSIONS.WAREHOUSE_MANAGE_BOXES, role); }

export function getWarehouseAccess(role) {
  const permissions = permissionsForRole(role);
  return Object.freeze({
    role,
    view: permissions.has(PERMISSIONS.WAREHOUSE_VIEW),
    edit: permissions.has(PERMISSIONS.WAREHOUSE_EDIT),
    publish: permissions.has(PERMISSIONS.WAREHOUSE_PUBLISH),
    manageZones: permissions.has(PERMISSIONS.WAREHOUSE_MANAGE_ZONES),
    manageGeometry: permissions.has(PERMISSIONS.WAREHOUSE_MANAGE_GEOMETRY),
    manageBoxes: permissions.has(PERMISSIONS.WAREHOUSE_MANAGE_BOXES)
  });
}
