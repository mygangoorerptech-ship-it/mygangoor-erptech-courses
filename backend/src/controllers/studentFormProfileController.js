//src/controllers/studentFormProfileController.js
import StudentFormProfile from "../models/StudentFormProfile.js";
import { toId } from "../utils/ids.js";

export async function getFormProfile(req, res) {
  try {
    const studentId = toId(req.user._id || req.user.sub || req.user.id);
    if (!studentId) return res.status(401).json({ ok: false });

    const profile = await StudentFormProfile.findOne({ studentId }).lean();
    return res.json({ ok: true, profile: profile || null });
  } catch (e) {
    console.error("[formProfile.get]", e);
    return res.status(500).json({ ok: false });
  }
}

// Internal helper — not exposed as a route handler.
// Fire-and-forget: callers must NOT await this.
export async function upsertFormProfileInternal(studentId, joinForm) {
  if (!studentId || !joinForm) return;
  const fullName = String(joinForm?.fullName || "").trim();
  const age = joinForm?.age;
  const gender = joinForm?.gender;
  const birth = String(joinForm?.birth || "").trim();
  const address = String(joinForm?.address || "").trim();
  const mobile = String(joinForm?.mobile || "").trim();
  const email = String(joinForm?.email || "").trim();
  const photoUrl = String(joinForm?.photoUrl || "").trim();
  return StudentFormProfile.findOneAndUpdate(
    { studentId },
    { $set: { fullName, age, gender, birth, address, mobile, email, photoUrl, source: "enrollment" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).catch((e) => console.error("[formProfile.upsert]", e?.message));
}
