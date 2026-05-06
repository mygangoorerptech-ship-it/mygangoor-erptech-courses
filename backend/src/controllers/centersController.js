// backend/src/controllers/centersController.js
import Center from "../models/Center.js";
import { safeRegex } from "../utils/safeRegex.js";

const HEX24 = /^[0-9a-fA-F]{24}$/;

function sanitize(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id:        String(o._id),
    name:      o.name,
    location:  o.location  || null,
    region:    o.region    || null,
    address:   o.address   || null,
    orgId:     o.orgId ? String(o.orgId) : null,
    status:    o.status || "active",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// GET /centers
export async function list(req, res) {
  const actor = req.user;
  const isSA = actor?.role === "superadmin";

  // SA may filter by a specific org; others are locked to their own org
  let orgId = isSA
    ? (req.query.orgId && HEX24.test(req.query.orgId) ? req.query.orgId : null)
    : actor?.orgId;

  if (!isSA && !orgId) return res.status(403).json({ ok: false, message: "No org" });

  const { q, status = "all" } = req.query;
  const filter = {};
  if (orgId) filter.orgId = orgId;
  if (status !== "all") filter.status = status;
  if (q) {
    const rx = { $regex: safeRegex(q), $options: "i" };
    filter.$or = [{ name: rx }, { location: rx }, { region: rx }];
  }

  const docs = await Center.find(filter).sort({ name: 1 });
  return res.json(docs.map(sanitize));
}

// POST /centers
export async function create(req, res) {
  const actor = req.user;
  const isSA = actor?.role === "superadmin";

  const { name, location, region, address, orgId: bodyOrgId } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ ok: false, message: "name required" });

  let orgId;
  if (isSA) {
    orgId = bodyOrgId && HEX24.test(String(bodyOrgId)) ? bodyOrgId : actor?.orgId;
  } else {
    orgId = actor?.orgId;
  }
  if (!orgId) return res.status(403).json({ ok: false, message: "No org" });

  const doc = await Center.create({
    name: name.trim(),
    location: location?.trim() || undefined,
    region:   region?.trim()   || undefined,
    address:  address?.trim()  || undefined,
    orgId,
    status: "active",
    createdBy: actor._id || actor.sub,
  });

  return res.status(201).json(sanitize(doc));
}

// PATCH /centers/:id
export async function patch(req, res) {
  const actor = req.user;
  const isSA = actor?.role === "superadmin";
  const { id } = req.params;

  if (!HEX24.test(id)) return res.status(400).json({ ok: false, message: "Invalid id" });

  const filter = { _id: id };
  if (!isSA) filter.orgId = actor?.orgId;

  const doc = await Center.findOne(filter);
  if (!doc) return res.status(404).json({ ok: false, message: "Center not found" });

  const allowed = ["name", "location", "region", "address", "status"];
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, k)) {
      doc[k] = req.body[k];
    }
  }
  doc.updatedBy = actor._id || actor.sub;
  await doc.save();

  return res.json(sanitize(doc));
}

// DELETE /centers/:id  — soft delete only (preserves CourseAssignment integrity)
export async function remove(req, res) {
  const actor = req.user;
  const isSA = actor?.role === "superadmin";
  const { id } = req.params;

  if (!HEX24.test(id)) return res.status(400).json({ ok: false, message: "Invalid id" });

  const filter = { _id: id };
  if (!isSA) filter.orgId = actor?.orgId;

  const doc = await Center.findOne(filter);
  if (!doc) return res.status(404).json({ ok: false, message: "Center not found" });

  doc.status = "inactive";
  doc.updatedBy = actor._id || actor.sub;
  await doc.save();

  return res.json({ ok: true });
}
