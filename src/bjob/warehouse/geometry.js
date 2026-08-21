/** Canonical geometry engine. Pure data/functions; no DOM or renderer dependencies. */

export const EPSILON = 0.01;

export function point(x = 0, y = 0) {
  return { x: Number(x) || 0, y: Number(y) || 0 };
}

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function samePoint(a, b, epsilon = EPSILON) {
  return distance(a, b) <= epsilon;
}

export function normalizeSegment(start, end) {
  return { start: point(start.x, start.y), end: point(end.x, end.y) };
}

export function snapPoint(candidate, points = [], epsilon = 12) {
  const p = point(candidate.x, candidate.y);
  let best = null;
  let bestDistance = epsilon;
  for (const target of points) {
    const d = distance(p, target);
    if (d <= bestDistance) {
      best = point(target.x, target.y);
      bestDistance = d;
    }
  }
  return best || p;
}

export function snapSegmentToEndpoints(segment, points, epsilon = 12) {
  return {
    start: snapPoint(segment.start, points, epsilon),
    end: snapPoint(segment.end, points, epsilon)
  };
}

export function rectangleWalls({ x, y, width, height, thickness = 8, idPrefix = 'rect-wall' } = {}) {
  const left = Number(x) || 0;
  const top = Number(y) || 0;
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const segments = [
    { start: point(left, top), end: point(left + w, top) },
    { start: point(left + w, top), end: point(left + w, top + h) },
    { start: point(left + w, top + h), end: point(left, top + h) },
    { start: point(left, top + h), end: point(left, top) }
  ];
  return segments.map((segment, index) => ({ ...segment, id: `${idPrefix}-${index}`, thickness }));
}

export function connectWalls(walls, epsilon = EPSILON) {
  const normalized = walls.map((wall, index) => ({
    ...wall,
    id: wall.id || `wall-${index}`,
    start: point(wall.start.x, wall.start.y),
    end: point(wall.end.x, wall.end.y),
    connections: []
  }));
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i];
      const b = normalized[j];
      const pairs = [
        ['start', a.start, 'start', b.start],
        ['start', a.start, 'end', b.end],
        ['end', a.end, 'start', b.start],
        ['end', a.end, 'end', b.end]
      ];
      for (const [aEndpoint, aPoint, bEndpoint, bPoint] of pairs) {
        if (!samePoint(aPoint, bPoint, epsilon)) continue;
        a.connections.push({ wallId: b.id, endpoint: aEndpoint, otherEndpoint: bEndpoint });
        b.connections.push({ wallId: a.id, endpoint: bEndpoint, otherEndpoint: aEndpoint });
      }
    }
  }
  return normalized;
}

function orientation(a, b, c) {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(value) <= EPSILON) return 0;
  return value > 0 ? 1 : -1;
}

function onSegment(a, b, p) {
  return p.x >= Math.min(a.x, b.x) - EPSILON && p.x <= Math.max(a.x, b.x) + EPSILON &&
    p.y >= Math.min(a.y, b.y) - EPSILON && p.y <= Math.max(a.y, b.y) + EPSILON;
}

export function segmentsIntersect(a, b, { allowSharedEndpoints = false } = {}) {
  const sharedEndpoint = samePoint(a.start, b.start) || samePoint(a.start, b.end) || samePoint(a.end, b.start) || samePoint(a.end, b.end);
  if (allowSharedEndpoints && sharedEndpoint) return false;

  const o1 = orientation(a.start, a.end, b.start);
  const o2 = orientation(a.start, a.end, b.end);
  const o3 = orientation(b.start, b.end, a.start);
  const o4 = orientation(b.start, b.end, a.end);

  if (o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) return true;
  if (o1 === 0 && onSegment(a.start, a.end, b.start)) return true;
  if (o2 === 0 && onSegment(a.start, a.end, b.end)) return true;
  if (o3 === 0 && onSegment(b.start, b.end, a.start)) return true;
  if (o4 === 0 && onSegment(b.start, b.end, a.end)) return true;
  return false;
}

export function validateWalls(walls = []) {
  const errors = [];
  for (let i = 0; i < walls.length; i += 1) {
    if (distance(walls[i].start, walls[i].end) <= EPSILON) {
      errors.push(`Стена ${walls[i].id || i}: нулевая длина.`);
    }
    for (let j = i + 1; j < walls.length; j += 1) {
      if (segmentsIntersect(walls[i], walls[j], { allowSharedEndpoints: true })) {
        errors.push(`Стены ${walls[i].id || i} и ${walls[j].id || j} пересекаются.`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function findClosedLoops(walls = []) {
  const connected = connectWalls(walls);
  const byId = new Map(connected.map(wall => [wall.id, wall]));
  const adjacency = new Map();

  const pointKey = p => `${p.x}:${p.y}`;
  for (const wall of connected) {
    for (const [from, to] of [[wall.start, wall.end], [wall.end, wall.start]]) {
      const key = pointKey(from);
      if (!adjacency.has(key)) adjacency.set(key, []);
      adjacency.get(key).push({ wallId: wall.id, point: to });
    }
  }

  const loops = [];
  const visitedEdges = new Set();
  for (const wall of connected) {
    for (const direction of ['forward', 'reverse']) {
      const start = direction === 'forward' ? wall.start : wall.end;
      const next = direction === 'forward' ? wall.end : wall.start;
      const firstEdge = `${wall.id}:${pointKey(start)}:${pointKey(next)}`;
      if (visitedEdges.has(firstEdge)) continue;

      const path = [start, next];
      let currentPoint = next;
      let currentWallId = wall.id;
      let previousPoint = start;
      let closed = false;

      for (let guard = 0; guard < connected.length + 1; guard += 1) {
        const candidates = (adjacency.get(pointKey(currentPoint)) || [])
          .filter(edge => edge.wallId !== currentWallId && !samePoint(edge.point, previousPoint));
        if (!candidates.length) break;

        const candidate = candidates[0];
        const edge = `${candidate.wallId}:${pointKey(currentPoint)}:${pointKey(candidate.point)}`;
        visitedEdges.add(`${currentWallId}:${pointKey(previousPoint)}:${pointKey(currentPoint)}`);
        if (samePoint(candidate.point, start)) {
          closed = true;
          break;
        }
        if (path.some(p => samePoint(p, candidate.point))) break;
        path.push(candidate.point);
        previousPoint = currentPoint;
        currentPoint = candidate.point;
        currentWallId = candidate.wallId;
        visitedEdges.add(edge);
      }

      if (closed && path.length >= 3) loops.push(path);
    }
  }

  // Remove duplicate loops caused by traversing the same cycle in both directions.
  const unique = new Map();
  for (const loop of loops) {
    const key = loop.map(pointKey).sort().join('|');
    if (!unique.has(key)) unique.set(key, loop);
  }
  return [...unique.values()];
}

export function rectangleFromDrag(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return { x, y, width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}
