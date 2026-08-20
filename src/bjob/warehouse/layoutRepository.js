import { LAYOUT_STATUS, normalizeLayout } from './domain.js';

const STORAGE_KEY = 'bjob:warehouse:layouts:v1';

function readStore() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listLayouts(warehouseId) {
  const store = readStore();
  return Object.values(store)
    .filter(layout => !warehouseId || layout.warehouseId === warehouseId)
    .map(normalizeLayout)
    .sort((a, b) => b.version - a.version);
}

export function getPublishedLayout(warehouseId) {
  return listLayouts(warehouseId).find(layout => layout.status === LAYOUT_STATUS.PUBLISHED) || null;
}

export function getDraftLayout(warehouseId) {
  return listLayouts(warehouseId).find(layout => layout.status === LAYOUT_STATUS.DRAFT) || null;
}

export function saveDraft(layout) {
  const normalized = normalizeLayout({ ...layout, status: LAYOUT_STATUS.DRAFT });
  normalized.revision = Number(normalized.revision || 0) + 1;
  normalized.updatedAt = new Date().toISOString();
  const store = readStore();
  store[normalized.id] = normalized;
  writeStore(store);
  return normalized;
}

export function publishLayout(layout) {
  const normalized = normalizeLayout(layout);
  const store = readStore();
  for (const existing of Object.values(store)) {
    if (existing.warehouseId === normalized.warehouseId && existing.status === LAYOUT_STATUS.PUBLISHED) {
      store[existing.id] = { ...existing, status: LAYOUT_STATUS.ARCHIVED };
    }
  }
  normalized.status = LAYOUT_STATUS.PUBLISHED;
  normalized.publishedAt = new Date().toISOString();
  normalized.updatedAt = normalized.publishedAt;
  store[normalized.id] = normalized;
  writeStore(store);
  return normalized;
}

export function validateLayout(layout) {
  const normalized = normalizeLayout(layout);
  const errors = [];
  if (!normalized.warehouseId) errors.push('Не указан склад.');
  if (!normalized.zones.length) errors.push('На схеме должна быть хотя бы одна зона.');
  for (const zone of normalized.zones) {
    if (!zone.name) errors.push(`Зона ${zone.id}: не указано название.`);
    if (zoneCapacityError(zone)) errors.push(`Зона «${zone.name}»: некорректная вместимость.`);
  }
  return { valid: errors.length === 0, errors };
}

function zoneCapacityError(zone) {
  return zone.rows < 1 || zone.columns < 1 || zone.capacity !== zone.rows * zone.columns;
}
