//backend/src/routes/auth.js
import { Router } from "express";
import * as ctrl from "../controllers/authController.js";
import jwt from "jsonwebtoken";

const r = Router();

function authz(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
    } catch {}
  }
  next();
}

r.post("/auth/login", ctrl.login);
r.post("/auth/mfa/send", ctrl.resendOtp);
r.post("/auth/mfa/verify", ctrl.verifyMfa);
r.post("/auth/totp/setup", ctrl.totpSetup);
r.post("/auth/totp/verify", ctrl.totpVerify);
r.get("/auth/check", ctrl.check);
r.post("/auth/refresh", ctrl.refresh);
r.post("/auth/logout", ctrl.logout);

r.post("/auth/invitations", authz, ctrl.invite);
r.post("/invitations/accept", ctrl.acceptInvite);
r.get("/invitations/verify", ctrl.verifyInvitation);

r.get('/auth/precheck', ctrl.precheckEmail);
r.post('/auth/signup-student', ctrl.signupStudent);
r.post('/auth/signup', ctrl.signupStudent);
r.post('/auth/forgot-password', ctrl.forgotPassword);
r.post('/auth/reset-password', ctrl.resetPassword);

export default r;
