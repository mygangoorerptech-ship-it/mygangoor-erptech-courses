//backend/src/utils/jwt.js
import jwt from "jsonwebtoken";

const ACCESS_TTL = "15m";
const REFRESH_TTL = "30d";
const MFA_TTL = "10m";

export const signAccessToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
export const signRefreshToken = (payload) => jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });
export const signMfaTempToken = (payload) => jwt.sign(payload, process.env.JWT_MFA_SECRET, { expiresIn: MFA_TTL });

export const verifyMfaTempToken = (token) => jwt.verify(token, process.env.JWT_MFA_SECRET);
