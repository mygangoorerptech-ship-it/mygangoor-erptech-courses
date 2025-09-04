// backend/src/controllers/wishlistController.js
import mongoose from "mongoose";
import WishlistItem from "../models/WishlistItem.js";

export async function list(req, res) {
  try {
    const uid = req.user?.id || req.user?._id;
    if (!uid) return res.status(401).json({ ok:false, message: "Unauthorized" });
    const rows = await WishlistItem.find({ userId: uid }).select("courseId -_id").lean();
    const items = rows.map(r => String(r.courseId));
    return res.json({ items });
  } catch (e) {
    console.error("[wishlist.list] error:", e);
    return res.status(500).json({ ok:false, message: "Internal error" });
  }
}

export async function toggle(req, res) {
  try {
    const uid = req.user?.id || req.user?._id;
    if (!uid) return res.status(401).json({ ok:false, message: "Unauthorized" });
    const { courseId } = req.body || {};
    if (!courseId) return res.status(400).json({ ok:false, message: "courseId required" });

    const cid = new mongoose.Types.ObjectId(courseId);
    const found = await WishlistItem.findOne({ userId: uid, courseId: cid }).lean();
    if (found) {
      await WishlistItem.deleteOne({ _id: found._id });
      return res.json({ ok:true, wishlisted:false });
    } else {
      await WishlistItem.create({ userId: uid, courseId: cid });
      return res.json({ ok:true, wishlisted:true });
    }
  } catch (e) {
    console.error("[wishlist.toggle] error:", e);
    if (String(e?.code) === "11000") return res.json({ ok:true, wishlisted:true }); // race-safe
    return res.status(500).json({ ok:false, message: "Internal error" });
  }
}
