//backend/src/controllers/assessmentGroupsController.js
import AssessmentGroup from "../models/AssessmentGroup.js";

export async function list(req, res) {
  const { scope, orgId, includeInactive } = req.query || {};
  const and = [];
  if (scope) and.push({ scope });
  if (orgId) and.push({ orgId });
  if (!includeInactive) and.push({ isActive: true });
  const where = and.length ? { $and: and } : {};
  const groups = await AssessmentGroup.find(where).sort({ order: 1, name: 1 }).lean();
  return res.json({ groups });
}

export async function create(req, res) {
  const actor = req.user || {};
  const { name, scope = "org", orgId = null } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  if (scope === "org" && !orgId) return res.status(400).json({ error: "orgId required for org scope" });
  try {
    const group = await AssessmentGroup.create({ name, scope, orgId, createdBy: actor.sub || actor._id || null });
    return res.status(201).json({ group });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ error: "duplicate" });
    throw e;
  }
}

export async function update(req, res) {
  const { id } = req.params;
  const payload = req.body || {};
  const group = await AssessmentGroup.findByIdAndUpdate(id, payload, { new: true });
  if (!group) return res.status(404).json({ error: "not found" });
  return res.json({ group });
}

export async function destroy(req, res) {
  const { id } = req.params;
  await AssessmentGroup.deleteOne({ _id: id });
  return res.json({ ok: true });
}
