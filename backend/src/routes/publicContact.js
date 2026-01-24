import { Router } from "express";
import rateLimit from "express-rate-limit";
import { submitPublic } from "../controllers/contactMessagesController.js";

const r = Router();

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "contact-rate-limited" },
});

r.post("/contact", contactLimiter, submitPublic);

export default r;
