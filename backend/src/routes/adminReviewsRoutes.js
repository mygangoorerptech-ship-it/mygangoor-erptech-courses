// backend/src/routes/reviewsRoutes.js
import { Router } from "express";
import { list, summary, updateOne, removeOne } from "../controllers/adminReviewsController.js";

const router = Router();
// Make sure your auth middleware runs before this router in server.js
router.get("/reviews", list);
router.get("/reviews/summary", summary);
router.patch("/reviews/:id", updateOne);   // superadmin only
router.delete("/reviews/:id", removeOne);  // superadmin only
export default router;
