// backend/scripts/resetSuperadminTotp.js
import { connectMongo, disconnectMongo } from "../src/config/mongo.js";
import { env } from "../src/config/env.js";
import User from "../src/models/User.js";

(async function run() {
  await connectMongo();
  const email = env("SUPERADMIN_EMAIL", "mithunkumarkulal33@gmail.com");
  const u = await User.findOne({ email });
  if (!u) throw new Error("Superadmin not found");
  u.mfa = { required: true, method: "totp", totpSecretHash: null, emailOtp: null };
  await u.save();
  console.log("[mfa] cleared TOTP secret for:", email);
  await disconnectMongo();
})();
