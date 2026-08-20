import { createBox, createLayout, createWall, createZone, normalizeLayout } from './domain.js';

export const LEGACY_STORAGE_KEY = 'bjob:fbs:v2';

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function migrateFeature(feature, warnings) {
  if (!feature || typeof feature !== 'object') return [];
  const type = String(feature.type || '').toLowerCase();
  const x = asNumber(feature.x);
  const y = asNumber(feature.y);
  const width = Math.max(1, asNumber(feature.width, 1));
  const height = Math.max(1, asNumber(feature.height, 1));

  if (type === 'partition') {
    return [
      createWall({ start: { x, y }, end: { x: x + width, y }, thickness: Math.max(1, asNumber(feature.thickness, 8)) }),
      createWall({ start: { x: x + width, y }, end: { x: x + width, y: y + height }, thickness: Math.max(1, asNumber(feature.thickness, 8)) }),
      createWall({ start: { x: x + width, y: y + height }, end: { x, y: y + height }, thickness: Math.max(1, asNumber(feature.thickness, 8)) }),
      createWall({ start: { x, y: y + height }, end: { x, y }, thickness: Math.max(1, asNumber(feature.thickness, 8)) })
    ];
  }

  if (type === 'rect') {
    return [
      createWall({ start: { x, y }, end: { x: x + width, y } }),
      createWall({ start: { x: x + width, y }, end: { x: x + width, y: y + height } }),
      createWall({ start: { x: x + width, y: y + height }, end: { x, y: y + height } }),
      createWall({ start: { x, y: y + height }, end: { x, y } })
    ];
  }

  if (type === 'window' || type === 'door') {
    return [{ id: crypto.randomUUID(), type, x, y, width, height }];
  }

  if (type === 'route') {
    return [{ id: crypto.randomUUID(), type: 'direction', x, y, width, height, label: feature.label || '' }];
  }

  warnings.push(`Неизвестный feature type: ${feature.type || '(пусто)'}`);
  return [];
}

export function readLegacyWarehouse(raw = null) {
  const warnings = [];
  let source = raw;

  if (source == null) {
    try {
      source = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
    } catch (error) {
      return { ok: false, layout: null, warnings: ['Не удалось прочитать legacy storage.'], error };
    }
  }

  if (!source || typeof source !== 'object') {
    return { ok: false, layout: null, warnings: ['Legacy склад отсутствует или имеет неверный формат.'] };
  }

  const warehouseId = source.id || source.warehouseId || null;
  const layout = createLayout({ warehouseId });

  for (const feature of Array.isArray(source.features) ? source.features : []) {
    const migrated = migrateFeature(feature, warnings);
    for (const object of migrated) {
      if (object.type === 'direction') layout.directions.push(object);
      else if (object.type === 'window' || object.type === 'door') layout.openings.push(object);
      else layout.walls.push(object);
    }
  }

  for (const zone of Array.isArray(source.zones) ? source.zones : []) {
    const migratedZone = createZone({
      id: zone.id,
      name: zone.name || zone.title,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      rows: zone.rows || zone.grid?.rows || 1,
      columns: zone.columns || zone.grid?.columns || Math.max(1, Number(zone.capacity) || 1)
    });
    migratedZone.boxIds = Array.isArray(zone.boxIds) ? [...new Set(zone.boxIds)] : [];
    layout.zones.push(migratedZone);
  }

  const boxes = Array.isArray(source.boxes) ? source.boxes : [];
  const migratedBoxes = boxes.map(box => createBox({
    id: box.id,
    code: box.code || box.label || box.name,
    warehouseId,
    zoneId: box.zoneId || null,
    row: box.row ?? null,
    position: box.position ?? null,
    contents: Array.isArray(box.contents) ? box.contents : []
  }));

  const zoneIds = new Set(layout.zones.map(zone => zone.id));
  for (const box of migratedBoxes) {
    if (box.zoneId && !zoneIds.has(box.zoneId)) {
      warnings.push(`Короб ${box.code || box.id}: указана несуществующая зона ${box.zoneId}; оставлен без зоны.`);
      box.zoneId = null;
    }
  }

  for (const zone of layout.zones) {
    zone.boxIds = migratedBoxes.filter(box => box.zoneId === zone.id).map(box => box.id);
    if (zone.boxIds.length > zone.capacity) {
      warnings.push(`Зона «${zone.name}»: ${zone.boxIds.length} коробов при вместимости ${zone.capacity}. Требуется ручное перераспределение.`);
    }
  }

  return {
    ok: true,
    layout: normalizeLayout(layout),
    boxes: migratedBoxes,
    warnings
  };
}
