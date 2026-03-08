//backend/src/utils/jwt.js
import jwt from "jsonwebtoken";

const MFA_TTL = "10m";

// signAccessToken / signRefreshToken were removed — token minting is handled
// exclusively by mintTokens() in authController.js which uses JWT_ACCESS_SECRET
// and the ACCESS_TTL / REFRESH_TTL_SEC env vars as the single source of truth.

export const signMfaTempToken = (payload) => jwt.sign(payload, process.env.JWT_MFA_SECRET, { expiresIn: MFA_TTL });

export const verifyMfaTempToken = (token) => jwt.verify(token, process.env.JWT_MFA_SECRET);
