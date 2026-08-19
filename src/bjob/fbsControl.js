// Compatibility shim: the legacy FBS controller was removed in the clean architecture.
// Keep the boot contract stable until all old entrypoint references are removed.
export function initFbsCore(){ return true; }
