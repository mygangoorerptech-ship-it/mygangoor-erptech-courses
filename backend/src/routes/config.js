// backend/src/routes/config.js
import { Router } from "express";
import { getPlatformFeePaise } from "../config/platform.js";
import { requireAuthNoRole } from "../middleware/authz.js";

const r = Router();
// anyone authenticated can read platform config; adjust if you want it public
r.use(requireAuthNoRole);

r.get("/platform", (_req, res) => {
  return res.json({ platformFee: getPlatformFeePaise() });
});

export default r;
