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

export function rectangleWalls({ x, y, width, height, thickness = 8 } = {}) {
  const left = Number(x) || 0;
  const top = Number(y) || 0;
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  return [
    { start: point(left, top), end: point(left + w, top), thickness },
    { start: point(left + w, top), end: point(left + w, top + h), thickness },
    { start: point(left + w, top + h), end: point(left, top + h), thickness },
    { start: point(left, top + h), end: point(left, top), thickness }
  ];
}

export function connectWalls(walls, epsilon = EPSILON) {
  const normalized = walls.map(wall => ({
    ...wall,
    start: point(wall.start.x, wall.start.y),
    end: point(wall.end.x, wall.end.y),
    connections: []
  }));
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i];
      const b = normalized[j];
      if (samePoint(a.start, b.start, epsilon)) { a.connections.push({ wallId: b.id, endpoint: 'start', otherEndpoint: 'start' }); b.connections.push({ wallId: a.id, endpoint: 'start', otherEndpoint: 'start' }); }
      if (samePoint(a.start, b.end, epsilon)) { a.connections.push({ wallId: b.id, endpoint: 'start', otherEndpoint: 'end' }); b.connections.push({ wallId: a.id, endpoint: 'end', otherEndpoint: 'start' }); }
      if (samePoint(a.end, b.start, epsilon)) { a.connections.push({ wallId: b.id, endpoint: 'end', otherEndpoint: 'start' }); b.connections.push({ wallId: a.id, endpoint: 'start', otherEndpoint: 'end' }); }
      if (samePoint(a.end, b.end, epsilon)) { a.connections.push({ wallId: b.id, endpoint: 'end', otherEndpoint: 'end' }); b.connections.push({ wallId: a.id, endpoint: 'end', otherEndpoint: 'end' }); }
    }
  }
  return normalized;
}

export function segmentsIntersect(a, b) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const c1 = cross(a.start, a.end, b.start);
  const c2 = cross(a.start, a.end, b.end);
  const c3 = cross(b.start, b.end, a.start);
  const c4 = cross(b.start, b.end, a.end);
  return ((c1 > EPSILON && c2 < -EPSILON) || (c1 < -EPSILON && c2 > EPSILON)) &&
    ((c3 > EPSILON && c4 < -EPSILON) || (c3 < -EPSILON && c4 > EPSILON));
}

export function validateWalls(walls = []) {
  const errors = [];
  for (let i = 0; i < walls.length; i += 1) {
    if (distance(walls[i].start, walls[i].end) <= EPSILON) errors.push(`Стена ${walls[i].id || i}: нулевая длина.`);
    for (let j = i + 1; j < walls.length; j += 1) {
      if (segmentsIntersect(walls[i], walls[j])) errors.push(`Стены ${walls[i].id || i} и ${walls[j].id || j} пересекаются.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function findClosedLoops(walls = []) {
  const connected = connectWalls(walls);
  const adjacency = new Map();
  for (const wall of connected) {
    const key = p => `${p.x}:${p.y}`;
    for (const [from, to] of [[wall.start, wall.end], [wall.end, wall.start]]) {
      const k = key(from);
      if (!adjacency.has(k)) adjacency.set(k, []);
      adjacency.get(k).push({ wall, point: to });
    }
  }
  const loops = [];
  const visited = new Set();
  for (const wall of connected) {
    const startKey = `${wall.start.x}:${wall.start.y}`;
    const edgeKey = `${wall.id}:start`;
    if (visited.has(edgeKey)) continue;
    const path = [wall.start];
    let current = wall.start;
    let currentWall = wall;
    for (let guard = 0; guard < connected.length + 1; guard += 1) {
      const next = currentWall.start && samePoint(currentWall.start, current) ? currentWall.end : currentWall.start;
      path.push(next);
      const nextKey = `${next.x}:${next.y}`;
      if (nextKey === startKey) {
        loops.push(path);
        break;
      }
      const candidates = adjacency.get(nextKey) || [];
      const nextEdge = candidates.find(item => item.wall.id !== currentWall.id && !visited.has(`${item.wall.id}:${item.point.x}:${item.point.y}`));
      if (!nextEdge) break;
      visited.add(`${currentWall.id}:${current.x}:${current.y}`);
      current = next;
      currentWall = nextEdge.wall;
    }
  }
  return loops;
}

export function rectangleFromDrag(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return { x, y, width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}
