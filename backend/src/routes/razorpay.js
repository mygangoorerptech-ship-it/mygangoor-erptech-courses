// backend/src/routes/razorpay.js
import { Router } from "express";
import { requireAuth } from "../middleware/authz.js";
import * as ctrl from "../controllers/razorpayController.js";

const r = Router();

r.use(requireAuth); // student must be logged in
r.post("/order", ctrl.createOrder);
r.post("/verify", ctrl.verifyPayment);
r.get("/receipt/:orderId", ctrl.receipt);

export default r;