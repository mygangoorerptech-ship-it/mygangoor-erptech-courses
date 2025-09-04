// backend/src/routes/adUsers.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authz.js';
import * as ctrl from '../controllers/adUsersController.js';

const r = Router();
// Allow both admins and superadmins to manage org-level users. Superadmins will need to
// specify orgId in the query/body to scope their requests. Using an array here
// leverages the requireRole middleware's ability to compare against multiple roles.
r.use(requireAuth, requireRole(['admin', 'superadmin']));

r.get('/', ctrl.list);
r.post('/', ctrl.create);
r.patch('/:id', ctrl.patch);
r.post('/:id/status', ctrl.setStatus);
r.post('/:id/role', ctrl.setRole);     // optional, allows vendor<->student only
r.delete('/:id', ctrl.remove);
r.post('/bulk-upsert', ctrl.bulkUpsert);

export default r;
