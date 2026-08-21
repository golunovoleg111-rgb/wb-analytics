import { createLayout, createWall, LAYOUT_STATUS, OBJECT_TYPES, normalizeLayout } from './domain.js';
import { connectWalls, rectangleWalls, rectangleFromDrag, snapSegmentToEndpoints, validateWalls } from './geometry.js';
import { requirePermission } from './permissions.js';

export const EDITOR_TOOLS = Object.freeze({
  LINE: 'line',
  RECTANGLE: 'rectangle',
  SELECT: 'select'
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createEditorSession({ layout = null, role } = {}) {
  requirePermission(role, 'warehouse.edit');
  const initial = normalizeLayout(layout || createLayout());
  return {
    role,
    activeTool: EDITOR_TOOLS.SELECT,
    layout: clone(initial),
    selectedId: null,
    dirty: false
  };
}

export function setEditorTool(session, tool) {
  if (!Object.values(EDITOR_TOOLS).includes(tool)) throw new Error(`Неизвестный инструмент: ${tool}`);
  return { ...session, activeTool: tool };
}

export function addLine(session, start, end, { snapPoints = [], snapEpsilon = 12, thickness = 8 } = {}) {
  const snapped = snapSegmentToEndpoints({ start, end }, snapPoints, snapEpsilon);
  const wall = createWall({ start: snapped.start, end: snapped.end, thickness });
  const walls = connectWalls([...session.layout.walls, wall]);
  return {
    ...session,
    layout: { ...session.layout, walls },
    dirty: true,
    selectedId: wall.id
  };
}

export function addRectangle(session, start, end, { snapPoints = [], snapEpsilon = 12, thickness = 8 } = {}) {
  const rect = rectangleFromDrag(start, end);
  const walls = rectangleWalls(rect).map(wall => createWall({
    ...wall,
    thickness
  }));
  const snappedWalls = walls.map(wall => snapSegmentToEndpoints(wall, snapPoints, snapEpsilon));
  const connected = connectWalls([
    ...session.layout.walls,
    ...snappedWalls.map((wall, index) => ({ ...wall, id: walls[index].id }))
  ]);
  return {
    ...session,
    layout: { ...session.layout, walls: connected },
    dirty: true,
    selectedId: walls[0]?.id || null
  };
}

export function validateEditorLayout(session) {
  const result = validateWalls(session.layout.walls);
  return {
    ...result,
    status: result.valid ? LAYOUT_STATUS.VALIDATING : LAYOUT_STATUS.DRAFT
  };
}

export function publishEditorLayout(session) {
  requirePermission(session.role, 'warehouse.publish');
  const validation = validateEditorLayout(session);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return {
    ...session,
    layout: { ...session.layout, status: LAYOUT_STATUS.PUBLISHED, publishedAt: new Date().toISOString() },
    dirty: false
  };
}

export function isEditableObjectType(type) {
  return type === OBJECT_TYPES.WALL || type === OBJECT_TYPES.ROOM || type === OBJECT_TYPES.WINDOW || type === OBJECT_TYPES.DOOR || type === OBJECT_TYPES.DIRECTION || type === OBJECT_TYPES.ZONE;
}

export function removeSelectedWall(session) {
  requirePermission(session.role, 'warehouse.edit');
  if (!session.selectedId) return session;
  const walls = session.layout.walls.filter(wall => wall.id !== session.selectedId);
  return {
    ...session,
    layout: { ...session.layout, walls: connectWalls(walls) },
    selectedId: null,
    dirty: true
  };
}
