// backend/src/routes/notifications.js
import express from "express";
import { requireAuth } from "../middleware/authz.js";
import { list, markRead, dismiss, stream } from "../controllers/notificationsController.js";

const router = express.Router();

router.get("/notifications", requireAuth, list);
router.post("/notifications/:id/read", requireAuth, markRead);
router.post("/notifications/:id/dismiss", requireAuth, dismiss);
router.get("/notifications/stream", requireAuth, stream);

export default router;
