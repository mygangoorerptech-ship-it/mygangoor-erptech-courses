// backend/src/routes/saUsers.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authz.js';
import * as ctrl from '../controllers/saUsersController.js';

const r = Router();
r.use(requireAuth, requireRole('superadmin'));

r.get('/', ctrl.list);
r.post('/', ctrl.create);
r.patch('/:id', ctrl.patch);
r.post('/:id/status', ctrl.setStatus);
r.post('/:id/role', ctrl.setRole);
r.delete('/:id', ctrl.remove);
r.post('/bulk-upsert', ctrl.bulkUpsert);

export default r;
