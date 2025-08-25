// backend/scripts/seedSuperadmin.js  (ESM)
import bcrypt from "bcryptjs";
import { connectMongo, disconnectMongo } from "../src/config/mongo.js";
import { env } from "../src/config/env.js";
import User from "../src/models/User.js";

(async function run() {
  try {
    await connectMongo();

    const email = env("SUPERADMIN_EMAIL", "superadmin@example.com");
    const pass = env("SUPERADMIN_PASSWORD", "ChangeMe123!");
    const passwordHash = await bcrypt.hash(pass, 10);

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: "Super Admin",
        passwordHash,
        role: "superadmin",
        mfa: { required: true, method: "totp" } // change to "otp" if you prefer email OTP
      });
      console.log("[seed] Superadmin created:", email);
    } else {
      console.log("[seed] Superadmin already exists:", email);
    }
  } catch (e) {
    console.error("[seed] failed:", e);
    process.exitCode = 1;
  } finally {
    await disconnectMongo();
  }
})();
