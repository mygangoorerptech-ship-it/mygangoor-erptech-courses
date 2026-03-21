//backend/src/controllers/assessmentsController.js
import mongoose from "mongoose";
import Assessment from "../models/Assessment.js";
import Organization from "../models/Organization.js";

function sanitize(doc) {
  if (!doc) return doc;
  const o = doc.toObject ? doc.toObject() : doc;
  return Object.assign(o, { id: String(o._id) });
}

export async function list(req, res) {
  const actor = req.user || {};
  const { q = "", status = "all", orgId } = req.query || {};
  const and = [];

  if (q) {
    and.push({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ],
    });
  }
  if (status && status !== "all") and.push({ status });

  if (actor.role === "superadmin") {
    if (orgId === "global") and.push({ orgId: null });
    else if (orgId) and.push({ orgId });
  } else {
    if (!actor.orgId) return res.status(403).json({ ok: false, message: "No org" });
    and.push({ $or: [{ orgId: actor.orgId }, { orgId: null }] });
  }

  const where = and.length ? { $and: and } : {};
  const rows = await Assessment.find(where).sort({ createdAt: -1 }).lean();

  const orgIds = [...new Set(rows.map(r => r.orgId).filter(Boolean))];
  let nameById = {};
  if (orgIds.length) {
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select({ _id: 1, name: 1 })
      .lean();
    nameById = Object.fromEntries(orgs.map(o => [String(o._id), o.name]));
  }

  return res.json(
    rows.map(r => ({
      ...sanitize(r),
      orgName: r.orgId ? nameById[String(r.orgId)] : "Global",
    }))
  );
}

export async function create(req, res) {
   try {
     const actor = req.user || {};
     const actorId = actor.sub || actor._id || actor.id || actor.uid || null;

     let {
       title,
       description = "",
       orgId,
       status = "draft",
       isActive = true,
       groupId = null,
       group = "",
       groupOrder = null,
       openAt = null,
       closeAt = null,
       timeLimitSeconds = null,
       maxAttempts = 1,
       questions = [],
       timeLimitMin = 0,
       passingScore = 0,
       totalQuestions = 0,
       tags = [],
     } = req.body || {};

     if (!title) {
       return res.status(400).json({ ok: false, message: "title required" });
     }

     // Normalize user-controlled inputs
     const toNull = (v) => (v === undefined || v === null || v === "" ? null : v);
     const safeOrgIdInput = orgId === "global" ? null : toNull(orgId);
     const safeGroupIdInput = toNull(groupId);

     // Decide org based on role
     let resolvedOrgId = null;
     let managerId = null;
     if (actor.role === "superadmin") {
       resolvedOrgId = safeOrgIdInput || null;
     } else {
       if (!actor.orgId) return res.status(403).json({ ok: false, message: "No org" });
       resolvedOrgId = actor.orgId;
       if (actor.role === "teacher") managerId = actorId || actor.managerId || null;
     }

     // Coerce time limit: null unless >=30
     let tls = toNull(timeLimitSeconds);
     if (tls !== null) {
       tls = Number(tls);
       if (!Number.isFinite(tls) || tls < 30) tls = null; // avoid schema min error
     }

     // Make groupId safe (avoid CastError)
     const safeGroupId =
       safeGroupIdInput && mongoose.Types.ObjectId.isValid(String(safeGroupIdInput))
         ? safeGroupIdInput
         : null;

     if (Array.isArray(questions) && questions.length) {
       totalQuestions = questions.length;
     }

     const doc = await Assessment.create({
       title,
       description,
       orgId: resolvedOrgId,
       createdBy: actorId,
       managerId,
       status: ["draft", "published", "archived"].includes(status) ? status : "draft",
       isActive: Boolean(isActive),
       groupId: safeGroupId,
       group: group || "",
       groupOrder: groupOrder ?? null,
       openAt: openAt ? new Date(openAt) : null,
       closeAt: closeAt ? new Date(closeAt) : null,
       timeLimitSeconds: tls,
       maxAttempts: Math.max(1, Number(maxAttempts) || 1),
       questions: Array.isArray(questions) ? questions : [],
       timeLimitMin: Number(timeLimitMin) || 0,
       passingScore: Number(passingScore) || 0,
       totalQuestions: Number(totalQuestions) || 0,
       tags: Array.isArray(tags) ? tags : [],
     });

     let orgName;
     if (resolvedOrgId) {
       const org = await Organization.findById(resolvedOrgId).select("name").lean();
       orgName = org?.name;
     }

     return res.status(201).json({
       ...sanitize(doc),
       orgName: resolvedOrgId ? orgName : "Global",
     });
   } catch (err) {
     if (err?.name === "ValidationError" || err?.name === "CastError") {
       return res.status(400).json({ ok: false, message: err.message });
     }
     console.error("create assessment error:", err);
     return res.status(500).json({ ok: false, message: "Failed to create assessment" });
   }
}

export async function update(req, res) {
  const actor = req.user || {};
  const { id } = req.params;

  const doc = await Assessment.findById(id);
  if (!doc) return res.status(404).json({ ok: false });

  if (actor.role !== "superadmin") {
    if (!actor.orgId) return res.status(403).json({ ok: false });
    if (String(doc.orgId || "") !== String(actor.orgId || "")) {
      return res.status(403).json({ ok: false });
    }
  }

  const allowed = [
    "title",
    "description",
    "status",
    "isActive",
    "timeLimitMin",
    "passingScore",
    "totalQuestions",
    "tags",
    "groupId",
    "group",
    "groupOrder",
    "openAt",
    "closeAt",
    "timeLimitSeconds",
    "maxAttempts",
    "questions",
  ];
  for (const k of allowed) if (k in req.body) doc[k] = req.body[k];

  if (actor.role === "superadmin" && "orgId" in req.body) {
    doc.orgId = req.body.orgId || null;
  }

  await doc.save();

  let orgName;
  if (doc.orgId) {
    const org = await Organization.findById(doc.orgId).select("name").lean();
    orgName = org?.name;
  }
  return res.json({ ...sanitize(doc), orgName: doc.orgId ? orgName : "Global" });
}

export async function setStatus(req, res) {
  const actor = req.user || {};
  const { id } = req.params;
  const { status } = req.body || {};
  if (!["draft", "published", "archived"].includes(status)) {
    return res.status(400).json({ ok: false });
  }

  const doc = await Assessment.findById(id);
  if (!doc) return res.status(404).json({ ok: false });

  if (actor.role !== "superadmin") {
    if (!actor.orgId) return res.status(403).json({ ok: false });
    if (String(doc.orgId || "") !== String(actor.orgId || "")) {
      return res.status(403).json({ ok: false });
    }
  }

  doc.status = status;
  await doc.save();

  let orgName;
  if (doc.orgId) {
    const org = await Organization.findById(doc.orgId).select("name").lean();
    orgName = org?.name;
  }
  return res.json({ ...sanitize(doc), orgName: doc.orgId ? orgName : "Global" });
}

export async function destroy(req, res) {
  const actor = req.user || {};
  const { id } = req.params;

  const doc = await Assessment.findById(id);
  if (!doc) return res.status(404).json({ ok: false });

  if (actor.role !== "superadmin") {
    if (!actor.orgId) return res.status(403).json({ ok: false });
    if (String(doc.orgId || "") !== String(actor.orgId || "")) {
      return res.status(403).json({ ok: false });
    }
  }

  await Assessment.deleteOne({ _id: id });
  return res.json({ ok: true });
}

export async function listByGroup(req, res) {
  const { groupId } = req.params;
  if (!groupId) return res.json({ items: [] });
  const items = await Assessment.find({ groupId })
    .sort({ groupOrder: 1, createdAt: 1 })
    .select({ title: 1, groupOrder: 1, createdAt: 1 })
    .lean();
  return res.json({
    items: items.map((x) => ({
      _id: String(x._id),
      title: x.title,
      groupOrder: x.groupOrder,
      createdAt: x.createdAt,
    })),
  });
}
