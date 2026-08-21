import { describe, expect, it } from 'vitest';
import { connectWalls, findClosedLoops, rectangleFromDrag, rectangleWalls, segmentsIntersect, snapPoint, validateWalls } from './geometry.js';

describe('warehouse geometry', () => {
  it('creates four uniquely identifiable walls from a rectangle', () => {
    const walls = rectangleWalls({ x: 10, y: 20, width: 100, height: 50 });
    expect(walls).toHaveLength(4);
    expect(new Set(walls.map(wall => wall.id)).size).toBe(4);
    expect(walls[0].start).toEqual({ x: 10, y: 20 });
    expect(walls[3].end).toEqual({ x: 10, y: 20 });
  });

  it('snaps a line endpoint to an existing wall endpoint', () => {
    expect(snapPoint({ x: 102, y: 101 }, [{ x: 100, y: 100 }], 5)).toEqual({ x: 100, y: 100 });
  });

  it('detects connected walls and assigns ids when missing', () => {
    const walls = rectangleWalls({ x: 0, y: 0, width: 100, height: 100 }).map(({ id, ...wall }) => wall);
    const connected = connectWalls(walls);
    expect(connected.every(wall => wall.id)).toBe(true);
    expect(connected.every(wall => wall.connections.length >= 2)).toBe(true);
  });

  it('detects proper crossing segments', () => {
    expect(segmentsIntersect(
      { start: { x: 0, y: 0 }, end: { x: 100, y: 100 } },
      { start: { x: 0, y: 100 }, end: { x: 100, y: 0 } }
    )).toBe(true);
  });

  it('detects collinear overlap', () => {
    expect(segmentsIntersect(
      { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      { start: { x: 50, y: 0 }, end: { x: 150, y: 0 } }
    )).toBe(true);
  });

  it('does not treat a shared endpoint as an invalid crossing', () => {
    expect(segmentsIntersect(
      { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      { start: { x: 100, y: 0 }, end: { x: 100, y: 100 } },
      { allowSharedEndpoints: true }
    )).toBe(false);
  });

  it('rejects zero-length walls', () => {
    const result = validateWalls([{ id: 'w1', start: { x: 1, y: 1 }, end: { x: 1, y: 1 } }]);
    expect(result.valid).toBe(false);
  });

  it('accepts a closed rectangle as a valid connected geometry', () => {
    const walls = rectangleWalls({ x: 0, y: 0, width: 100, height: 100 });
    expect(validateWalls(walls).valid).toBe(true);
    expect(findClosedLoops(walls)).toHaveLength(1);
  });

  it('normalizes drag in any direction', () => {
    expect(rectangleFromDrag({ x: 100, y: 80 }, { x: 20, y: 30 })).toEqual({ x: 20, y: 30, width: 80, height: 50 });
  });
});
