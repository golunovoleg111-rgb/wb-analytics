import { PHASE2_ROUTE_MANIFEST, routeIds } from './phase2RouteManifest.js';

const ids = routeIds();
if (new Set(ids).size !== ids.length) throw new Error('Duplicate Phase 2 route id');
if (PHASE2_ROUTE_MANIFEST.length !== 24) throw new Error(`Expected 24 Phase 2 routes, got ${PHASE2_ROUTE_MANIFEST.length}`);
for (const [id, label] of PHASE2_ROUTE_MANIFEST) {
  if (!id || !label) throw new Error('Phase 2 routes require id and label');
}
