// backend/src/controllers/publicCatalogController.js
import Course from "../models/Course.js";

/** Map DB course doc to lightweight public card */
function toCard(c) {
  const o = c.toObject ? c.toObject() : c;
  const courseType =
    o.courseType === "free" || o.courseType === "paid"
      ? o.courseType
      : Number(o.price) > 0
      ? "paid"
      : "free";

  return {
    id: String(o._id),
    slug: o.slug || null,
    title: o.title || "",
    courseType,               // "free" | "paid"
    price: Number(o.price) || 0,              // paise
    coverUrl: o.bundleCoverUrl || o.coverUrl || o.image || null,
    ratingAvg: Number(o.ratingAvg) || 0,
    ratingCount: Number(o.ratingCount) || 0,
    durationText: o.durationText || null,
    createdAt: o.createdAt || null,
  };
}

/** GET /api/public/catalog/featured
 * Latest 3 paid + latest 3 free (published + public). No auth.
 */
export async function featured(_req, res) {
  try {
    const baseMatch = { status: "published", visibility: "public" };

    const [paid, free] = await Promise.all([
      Course.find({ ...baseMatch, courseType: "paid" })
        .sort({ createdAt: -1, _id: -1 })
        .limit(3),
      Course.find({ ...baseMatch, courseType: "free" })
        .sort({ createdAt: -1, _id: -1 })
        .limit(3),
    ]);

    return res.json({
      paid: paid.map(toCard),
      free: free.map(toCard),
    });
  } catch (err) {
    console.error("[publicCatalog.featured] error:", err);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}
