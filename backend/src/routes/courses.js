//backend/src/routes/courses.js
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authz.js';
import * as ctrl from '../controllers/coursesController.js';

const r = Router();
r.use(requireAuth, requireRole(['admin','teacher','student']));

r.get('/', ctrl.list);
r.post('/', ctrl.create);
r.post('/bulk-upsert', ctrl.bulkUpsert);
r.patch('/:id', ctrl.patch);
r.post('/:id/status', ctrl.setStatus);
r.delete('/:id', ctrl.remove);

export default r;
