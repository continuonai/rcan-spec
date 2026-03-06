/**
 * rcan.dev — /api/v1/robots/:rrn
 * Routes GET, PATCH, DELETE for a single robot by RRN.
 * Delegates to the main index handler via re-export pattern.
 */
export { onRequest } from "./index.js";
