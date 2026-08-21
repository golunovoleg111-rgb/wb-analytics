import { describe, expect, it } from 'vitest';
import { createEditorSession, addLine, addRectangle, publishEditorLayout, removeSelectedWall } from './editorModel.js';

const manager = { role: 'manager' };
const picker = { role: 'picker' };

function session(role = manager.role) {
  return createEditorSession({ role });
}

describe('warehouse editor model', () => {
  it('allows a manager to create an editor session', () => {
    expect(session().activeTool).toBe('select');
  });

  it('does not allow a picker to create an editor session', () => {
    expect(() => session(picker.role)).toThrow(/Недостаточно прав/);
  });

  it('creates one wall with the line tool model', () => {
    const next = addLine(session(), { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(next.layout.walls).toHaveLength(1);
  });

  it('creates a rectangle as four walls', () => {
    const next = addRectangle(session(), { x: 0, y: 0 }, { x: 100, y: 60 });
    expect(next.layout.walls).toHaveLength(4);
    expect(next.layout.walls.every(wall => wall.connections.length >= 2)).toBe(true);
  });

  it('snaps a new line to an existing endpoint', () => {
    const first = addLine(session(), { x: 0, y: 0 }, { x: 100, y: 0 });
    const second = addLine(first, { x: 101, y: 1 }, { x: 150, y: 1 }, { snapPoints: [{ x: 100, y: 0 }], snapEpsilon: 5 });
    expect(second.layout.walls[1].start).toEqual({ x: 100, y: 0 });
  });

  it('requires publish permission to publish', () => {
    const pickerSession = { ...session(manager.role), role: picker.role };
    expect(() => publishEditorLayout(pickerSession)).toThrow(/Недостаточно прав/);
  });

  it('removes only the selected wall', () => {
    const created = addLine(session(), { x: 0, y: 0 }, { x: 100, y: 0 });
    const removed = removeSelectedWall(created);
    expect(removed.layout.walls).toHaveLength(0);
  });
});
