//backend/src/controllers/userController.js
import User from "../models/User.js";

export async function updateMfaPolicy(req, res) {
  const { id } = req.params;
  const { required, method } = req.body; // method: "otp" | "totp" | null

  if (typeof required !== "boolean") {
    return res.status(400).json({ ok: false, message: "required must be boolean" });
  }
  if (required && !["otp", "totp"].includes(method)) {
    return res.status(400).json({ ok: false, message: "method must be 'otp' or 'totp' when required=true" });
  }

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ ok: false, message: "User not found" });

  // Superadmin policy: superadmin must stay TOTP
  if (user.role === "superadmin") {
    user.mfa = { required: true, method: "totp", totpSecretHash: user.mfa?.totpSecretHash || null, emailOtp: null };
  } else {
    user.mfa = {
      required,
      method: required ? method : null,
      // Reset secret/otp when switching methods so they re-enroll
      totpSecretHash: required && method === "totp" ? null : null,
      emailOtp: null,
    };
  }

  await user.save();
  return res.json({ ok: true, user });
}
