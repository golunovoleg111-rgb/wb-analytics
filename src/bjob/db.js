// Compatibility bridge for legacy B-JOB modules that import ./db.js.
// Canonical database implementation lives at src/db.js.
export * from '../db.js';
import * as DB from '../db.js';
export default DB;
