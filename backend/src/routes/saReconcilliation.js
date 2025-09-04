// backend/src/routes/saReconcilliation.js
//
// NOTE: This file exists solely as a compatibility alias.  Some parts of
// the application may mistakenly import `saReconcilliation` (with a double
// 'l') instead of the correctly spelled `saReconciliation`.  To avoid
// `MODULE_NOT_FOUND` errors, this module simply re-exports the default
// export from the correct route file.  No additional functionality is
// implemented here.

export { default } from './saReconciliation.js';