// backend/src/routes/notes.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authz.js';
// NOTE: On some filesystems imports are case‑sensitive. There is only a
// `notes.Controller.js` controller in this project, so import that
// explicitly. Importing `notes.controller.js` (lowercase) would cause
// runtime failures on Linux where filenames are case sensitive and the file
// does not exist. See `src/controllers` for available controllers.
import * as notes from '../controllers/notes.Controller.js';

const r = Router();

/**
 * Student & Admin: list notes
 * - In the controller, if role is student/orguser, force `status='published'`
 *   (and optionally org/enrollment checks).
 * - Admins can see more via ?status=all or other filters.
 */
r.get('/', requireAuth, notes.list);

/**
 * Student & Admin: get a short-lived signed URL for a PDF note
 * (needed to avoid Cloudinary 401 on authenticated assets)
 */
// r.get('/:id/pdf-signed', requireAuth, notes.getPdfSignedUrl);

/** Admin/vendor only: create/update/status/delete */
// The requireRole() helper accepts a single argument. To allow multiple roles
// pass an array. Passing multiple string arguments like
// requireRole('superadmin','admin','vendor') would only take the first
// argument ("superadmin") and ignore the rest. See middleware/authz.js.
r.post('/',        requireAuth, requireRole(['superadmin','admin','vendor']), notes.create);
r.patch('/:id',    requireAuth, requireRole(['superadmin','admin','vendor']), notes.patch);
r.post('/:id/status', requireAuth, requireRole(['superadmin','admin','vendor']), notes.setStatus);
r.delete('/:id',   requireAuth, requireRole(['superadmin','admin','vendor']), notes.remove);

export default r;
