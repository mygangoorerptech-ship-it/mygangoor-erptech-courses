// backend/src/routes/adUsers.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authz.js';
import * as ctrl from '../controllers/adUsersController.js';

const r = Router();
r.use(requireAuth, requireRole('admin'));

r.get('/', ctrl.list);
r.post('/', ctrl.create);
r.patch('/:id', ctrl.patch);
r.post('/:id/status', ctrl.setStatus);
r.post('/:id/role', ctrl.setRole);     // optional, allows vendor<->student only
r.delete('/:id', ctrl.remove);
r.post('/bulk-upsert', ctrl.bulkUpsert);

export default r;
