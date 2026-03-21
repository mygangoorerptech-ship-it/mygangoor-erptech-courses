// backend/src/controllers/notes.Controller.js
import mongoose from "mongoose";
import sanitizeHtml from "sanitize-html";
import Note from "../models/Note.js";
import Course from "../models/Course.js";
import crypto from "node:crypto";
import https from "node:https";
import http from "node:http";
import { sendErr } from '../utils/http.js';
import {   NOTES_ACCESS,
  buildAuthenticatedPdfUrl,
  buildPublicPdfUrl, } from "../utils/cloudinary.js";

const allowTags = [
  "p","b","i","em","strong","u","s","blockquote","ul","ol","li","br","hr",
  "h1","h2","h3","h4","h5","h6","a","img","pre","code","table","thead","tbody","tr","th","td","span","div"
];
const allowAttrs = {
  a: ["href","title","target","rel"],
  img: ["src","alt","title","width","height","style"],
  "*": ["style"]
};

const { Types: { ObjectId } } = mongoose;
const isOid = (s) => typeof s === "string" && ObjectId.isValid(s);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex

// ---------- Debug helpers (enable with note_bug=1 | true | yes | on) ----------
const NOTE_BUG_RAW = (process.env.note_bug ?? process.env.NOTE_BUG ?? "").toString().toLowerCase();
const NOTE_BUG = ["1","true","yes","on","debug"].includes(NOTE_BUG_RAW);

const redactUrl = (u) => {
  if (!u || typeof u !== "string") return u;
  try {
    const url = new URL(u);
    // drop sensitive query params entirely
    url.searchParams.forEach((v, k) => {
      if (/(sig|token|secret|key|password|auth)/i.test(k)) url.searchParams.set(k, "***");
    });
    return url.toString();
  } catch {
    return u.replace(/(sig|token|secret|key|password)=([^&]+)/gi, "$1=***");
  }
};
const sjson = (o) => {
  try { return JSON.stringify(o); } catch { return String(o); }
};
const ridOf = (req) => req?.id || crypto.randomUUID();
const dlog = (req, ...args) => { if (NOTE_BUG) console.log(`[notes][${ridOf(req)}]`, ...args); };
const dwarn = (req, ...args) => { if (NOTE_BUG) console.warn(`[notes][${ridOf(req)}]`, ...args); };
const derr = (req, label, err, extra={}) => {
  const base = {
    label,
    name: err?.name,
    message: err?.message,
    stack: NOTE_BUG ? err?.stack : undefined,
    ...extra
  };
  console.error(`[notes][${ridOf(req)}]`, sjson(base));
};

// ---------- Access helpers ----------
function canManageCourse(actor, course) {
  if (!course) return false;
  if (actor?.role === "superadmin") return true;

  const isSameOrg = String(course.orgId) === String(actor.orgId);
  if (!isSameOrg) return false;

  if (actor.role === "admin") return true;

  if (actor.role === "teacher") {
    const ownerOk = course.ownerId && String(course.ownerId) === String(actor.sub);
    const mgrOk   = course.managerId && String(course.managerId) === String(actor.sub);
    return ownerOk || mgrOk;
  }
  return false;
}

function sanitize(doc) {
  const o = doc?.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    orgId: o.orgId ? String(o.orgId) : null,
    courseId: o.courseId ? String(o.courseId) : null,
    ownerId: o.ownerId ? String(o.ownerId) : null,
    title: o.title,
    kind: o.kind,
    html: o.kind === "rich" ? (o.html || "") : "",
    pdfUrl: o.kind === "pdf" ? (o.pdfUrl || "") : "",
    pdfPublicId: o.kind === "pdf" ? (o.pdfPublicId || "") : "",
    status: o.status || "published",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// GET /api/notes?courseId=...&status=published|draft|archived|all
export async function list(req, res) {
  const actor = req.user;
  const { courseId: rawCourseId, status = "all" } = req.query || {};

  if (!actor?.orgId && actor?.role !== "superadmin") {
    dwarn(req, "list: missing orgId for non-superadmin", { actor });
    return res.status(403).json({ ok: false, message: "No org" });
  }

  try {
    const and = [];
    // Scope by org for non-superadmin roles
    if (actor?.role !== "superadmin") {
      and.push({ orgId: actor.orgId });
    }

    dlog(req, "list: incoming", {
      rawCourseId,
      status,
      actor: { sub: actor?.sub, role: actor?.role, orgId: actor?.orgId }
    });

    // Accept courseId as ObjectId, slug, or exact title (case-insensitive)
    if (rawCourseId && rawCourseId !== "all") {
      if (isOid(rawCourseId)) {
        and.push({ courseId: rawCourseId });
        dlog(req, "list: filtering by OID", { courseId: rawCourseId });
      } else {
        const courseFilter = actor?.role === "superadmin" ? {} : { orgId: actor.orgId };

        const bySlug = await Course.findOne(
          { ...courseFilter, slug: rawCourseId },
          { _id: 1 }
        ).lean();

        const byTitle = bySlug || await Course.findOne(
          { ...courseFilter, title: new RegExp(`^${esc(rawCourseId)}$`, "i") },
          { _id: 1 }
        ).lean();

        dlog(req, "list: course resolution", {
          usedFilter: courseFilter,
          bySlug: bySlug?._id,
          byTitle: byTitle?._id
        });

        if (byTitle?._id) {
          and.push({ courseId: byTitle._id });
        } else {
          dwarn(req, "list: invalid-courseId", { rawCourseId });
          return res.status(400).json({ ok: false, message: "invalid-courseId" });
        }
      }
    }

    if (status && status !== "all") and.push({ status });

    const where = and.length ? { $and: and } : {};
    dlog(req, "list: where", where);

    console.time(`[notes][${ridOf(req)}] list:query`);
    const docs = await Note.find(where).sort({ createdAt: -1 });
    console.timeEnd(`[notes][${ridOf(req)}] list:query`);

    dlog(req, "list: result count", { count: docs.length });
    return res.json(docs.map(sanitize));
  } catch (err) {
    derr(req, "list:error", err, { rawCourseId, status });
    return res.status(500).json({ ok: false, message: "failed-to-list-notes" });
  }
}

// POST /api/notes
export async function create(req, res) {
  const actor = req.user;
  if (!actor?.orgId && actor?.role !== "superadmin") {
    dwarn(req, "create: missing orgId for non-superadmin", { actor });
    return res.status(403).json({ ok: false, message: "No org" });
  }

  const { courseId: rawCourseId, title, kind, html, pdfUrl, pdfPublicId, status } = req.body || {};
  dlog(req, "create: incoming", {
    rawCourseId, title, kind,
    htmlLen: (html || "").length,
    pdfUrl: redactUrl(pdfUrl),
    pdfPublicId,
    status,
    actor: { sub: actor?.sub, role: actor?.role, orgId: actor?.orgId }
  });

  if (!rawCourseId || !title || !kind) return res.status(400).json({ ok: false, message: "courseId,title,kind required" });
  if (!["rich","pdf"].includes(kind)) return res.status(400).json({ ok: false, message: "invalid kind" });

  const pick = { _id: 1, orgId: 1, ownerId: 1, managerId: 1 };

  let courseDoc = null;
  if (isOid(rawCourseId)) {
    courseDoc = await Course.findById(rawCourseId, pick).lean();
  } else {
    const courseFilter = actor?.role === "superadmin" ? {} : { orgId: actor.orgId };
    const bySlug = await Course.findOne({ ...courseFilter, slug: rawCourseId }, pick).lean();
    courseDoc = bySlug || await Course.findOne({ ...courseFilter, title: new RegExp(`^${esc(rawCourseId)}$`, "i") }, pick).lean();
  }

  dlog(req, "create: course resolved", { courseId: courseDoc?._id, courseOrg: courseDoc?.orgId });

  if (!courseDoc?._id) return res.status(400).json({ ok: false, message: "invalid-courseId" });

  if (!canManageCourse(actor, courseDoc)) {
    dwarn(req, "create: forbidden", {
      actorRole: actor.role, actorOrg: String(actor.orgId),
      courseOrg: String(courseDoc.orgId), rawCourseId
    });
    return res.status(403).json({ ok: false, message: "Forbidden" });
  }

  let htmlSafe = "";
  if (kind === "rich") {
    htmlSafe = sanitizeHtml(String(html || ""), {
      allowedTags: allowTags,
      allowedAttributes: allowAttrs,
      allowedIframeHostnames: [],
    });
  }

  const noteOrgId = actor?.role === "superadmin" ? courseDoc.orgId : actor.orgId;

  try {
    const doc = await Note.create({
      orgId: noteOrgId,
      courseId: courseDoc._id,
      ownerId: actor.sub,
      title: String(title).trim().slice(0, 200),
      kind,
      html: htmlSafe,
      pdfUrl:      kind === "pdf" ? String(pdfUrl || "")      : "",
      pdfPublicId: kind === "pdf" ? String(pdfPublicId || "") : "",
      status: status && ["draft","published","archived"].includes(status) ? status : "published",
      createdById: actor.sub,
    });
    dlog(req, "create: saved", { id: doc._id, kind, status: doc.status });
    return res.json(sanitize(doc));
  } catch (err) {
    derr(req, "create:error", err, { noteOrgId, courseId: courseDoc?._id, kind });
    return res.status(500).json({ ok: false, message: "failed-to-create-note" });
  }
}

// PATCH /api/notes/:id
export async function patch(req, res) {
  const actor = req.user;
  const id = req.params.id;
  dlog(req, "patch: incoming", { id, actor: { sub: actor?.sub, role: actor?.role, orgId: actor?.orgId } });

  try {
    const doc = await Note.findById(id);
    if (!doc) return res.status(404).json({ ok: false, message: "Not found" });

    const course = await Course.findById(doc.courseId);
    if (!canManageCourse(actor, course)) return res.status(403).json({ ok: false, message: "Forbidden" });

    const { title, status, html } = req.body || {};
    if (title != null) doc.title = String(title).trim().slice(0,200);
    if (status && ["draft","published","archived"].includes(status)) doc.status = status;
    if (html != null && doc.kind === "rich") {
      doc.html = sanitizeHtml(String(html), { allowedTags: allowTags, allowedAttributes: allowAttrs });
    }
    doc.updatedById = actor.sub;
    await doc.save();
    dlog(req, "patch: saved", { id: doc._id, status: doc.status });
    res.json(sanitize(doc));
  } catch (err) {
    derr(req, "patch:error", err, { id });
    res.status(500).json({ ok: false, message: "failed-to-patch-note" });
  }
}

// POST /api/notes/:id/status  { status }
export async function setStatus(req, res) {
  const actor = req.user;
  const id = req.params.id;
  const { status } = req.body || {};
  dlog(req, "setStatus: incoming", { id, status });

  if (!["draft","published","archived"].includes(status)) return res.status(400).json({ ok: false, message: "invalid status" });

  try {
    const doc = await Note.findById(id);
    if (!doc) return res.status(404).json({ ok: false, message: "Not found" });

    const course = await Course.findById(doc.courseId);
    if (!canManageCourse(actor, course)) return res.status(403).json({ ok: false, message: "Forbidden" });

    doc.status = status;
    doc.updatedById = actor.sub;
    await doc.save();
    dlog(req, "setStatus: saved", { id: doc._id, status });
    res.json(sanitize(doc));
  } catch (err) {
    derr(req, "setStatus:error", err, { id, status });
    res.status(500).json({ ok: false, message: "failed-to-set-status" });
  }
}

// DELETE /api/notes/:id
export async function remove(req, res) {
  const actor = req.user;
  const id = req.params.id;
  dlog(req, "remove: incoming", { id, actor: { sub: actor?.sub, role: actor?.role, orgId: actor?.orgId } });

  try {
    const doc = await Note.findById(id);
    if (!doc) return res.status(404).json({ ok: false, message: "Not found" });

    const course = await Course.findById(doc.courseId);
    if (!canManageCourse(actor, course)) return res.status(403).json({ ok: false, message: "Forbidden" });

    await Note.deleteOne({ _id: id });
    dlog(req, "remove: deleted", { id });
    res.json({ ok: true });
  } catch (err) {
    derr(req, "remove:error", err, { id });
    res.status(500).json({ ok: false, message: "failed-to-remove-note" });
  }
}

// ---------- Student read-only ----------

// ------------------ listForStudent (fix timer label) ------------------
export async function listForStudent(req, res) {
  const actor = req.user;
  const { courseId: rawCourseId } = req.query || {};
  const tLabel = `[notes][${ridOf(req)}] listForStudent:query`; // <-- fixed

  dlog(req, "listForStudent: incoming", {
    rawCourseId,
    actor: { sub: actor?.sub, role: actor?.role, orgId: actor?.orgId }
  });

  if (!rawCourseId) {
    dwarn(req, "listForStudent: missing courseId");
    return res.status(400).json({ ok:false, message:"courseId required" });
  }

  // Phase 3 fix: students without an orgId are not in any organisation, so
  // org-scoped notes cannot exist for them. Return an empty array (200) rather
  // than a 400 error — the frontend simply hides the "View Notes" button when
  // the array is empty.
  if (!actor?.orgId) {
    dlog(req, "listForStudent: actor has no orgId, returning empty");
    return res.json([]);
  }

  try {
    let courseIdFilter;
    if (isOid(rawCourseId)) {
      courseIdFilter = rawCourseId;
      dlog(req, "listForStudent: OID courseId", { courseIdFilter });
    } else {
      const bySlug = await Course.findOne(
        { orgId: actor.orgId, slug: rawCourseId },
        { _id: 1 }
      ).lean();
      const byTitle = bySlug || await Course.findOne(
        { orgId: actor.orgId, title: new RegExp(`^${esc(rawCourseId)}$`, "i") },
        { _id: 1 }
      ).lean();

      dlog(req, "listForStudent: course resolution", { bySlug: bySlug?._id, byTitle: byTitle?._id });
      if (!byTitle?._id) {
        dwarn(req, "listForStudent: invalid-courseId", { rawCourseId });
        return res.status(400).json({ ok:false, message:"invalid-courseId" });
      }
      courseIdFilter = byTitle._id;
    }

    const where = { orgId: actor.orgId, courseId: courseIdFilter, status: "published" };
    dlog(req, "listForStudent: where", where);

    console.time(tLabel);
    const docs = await Note.find(where).sort({ createdAt: -1 }).lean();
    console.timeEnd(tLabel);

    const out = docs.map(d => ({
      id: String(d._id),
      title: d.title,
      kind: d.kind,
      html: d.kind === "rich" ? (d.html || "") : "",
      pdfUrl: d.kind === "pdf" ? (d.pdfUrl || "") : "",
      createdAt: d.createdAt,
    }));
    dlog(req, "listForStudent: result count", { count: out.length });
    res.json(out);
  } catch (err) {
    derr(req, "listForStudent:error", err, { rawCourseId });
    res.status(500).json({ ok:false, message:"failed-to-list-notes" });
  }
}

// ------------------ helper: derive Cloudinary publicId if needed ------------------
function extractPublicIdFromUrl(u) {
  if (!u) return "";
  try {
    const url = new URL(u);
    const parts = url.pathname.split("/").filter(Boolean);
    // .../raw/authenticated/v<ver>/<path>/<name>.pdf
    const vIdx = parts.findIndex(p => /^v\d+$/i.test(p));
    const afterV = vIdx >= 0 ? parts.slice(vIdx + 1).join("/") : parts.slice(-2).join("/");
    return afterV.replace(/\.[a-z0-9]+$/i, "");
  } catch {
    return String(u).replace(/^.*\/v\d+\//, "").replace(/\.[a-z0-9]+$/i, "");
  }
}

// ------------------ NEW: presignStudentNote ------------------
export async function presignStudentNote(req, res, next) {
  try {
    const id = String(req.query.id || "").trim();
    const ttl = Math.max(60, Math.min(24 * 3600, Number(req.query.ttl || 3600)));
    if (!id) return sendErr(res, 400, "note-id-required");

    const note = await Note.findById(id).lean();
    if (!note) return sendErr(res, 404, "note-not-found");
    if (note.status !== "published") return sendErr(res, 403, "note-not-published");
    // Phase 2 fix: req.orgId is never populated by the auth middleware — the org
    // id lives on req.user.orgId. Using req.orgId always evaluated to falsy,
    // meaning the org ownership check was silently skipped on every request.
    const actorOrgId = req.user?.orgId;
    if (actorOrgId && String(note.orgId || "") !== String(actorOrgId)) return sendErr(res, 403, "forbidden");
    if (note.kind !== "pdf") return sendErr(res, 400, "note-not-a-pdf");

    const publicId = note.pdfPublicId || extractPublicIdFromUrl(note.pdfUrl);
    if (!publicId && !note.pdfUrl) return sendErr(res, 400, "note-has-no-pdf");

    // Detect the original storage type from the saved URL; fallback to global default
    const storedType =
      note.pdfUrl?.includes("/raw/authenticated/") ? "authenticated" :
      note.pdfUrl?.includes("/raw/private/")       ? "private" :
      note.pdfUrl?.includes("/raw/upload/")        ? "upload" :
      NOTES_ACCESS; // global default

    let url;
    if (storedType === "authenticated") {
      url = buildAuthenticatedPdfUrl(publicId, { ttl }); // -> /raw/authenticated/...__cld_token__=...
    } else {
      // Public path: some accounts require signed delivery even for upload
      url = note.pdfUrl?.startsWith("http")
        ? note.pdfUrl
        : buildPublicPdfUrl(publicId); // see function update below (now signs)
    }

    return res.json({ url, ttl });
  } catch (err) {
    return next(err);
  }
}

// ------------------ streamPdf ------------------
// Phase 2/7 fix: proxy the Cloudinary PDF through the backend so the browser
// never fetches directly from Cloudinary.
//
// Why this matters:
//   - Direct browser-to-Cloudinary requests require Cloudinary CORS to allow
//     the frontend domain. Configuring CORS per-bucket in Cloudinary is easy to
//     miss and hard to diagnose. This proxy sidesteps the requirement entirely.
//   - Auth credentials (cookies) are sent to our own backend domain, not
//     forwarded to a third-party CDN.
//   - No signed-URL TTL race conditions; the server fetches with a fresh short-
//     lived URL that never leaves the server.
//
// Route: GET /api/student/notes/pdf/:id
export async function streamPdf(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !ObjectId.isValid(id)) return sendErr(res, 400, "invalid-note-id");

    const note = await Note.findById(id).lean();
    if (!note) return sendErr(res, 404, "note-not-found");
    if (note.status !== "published") return sendErr(res, 403, "note-not-published");
    if (note.kind !== "pdf") return sendErr(res, 400, "note-not-a-pdf");

    // Org ownership check (same pattern as presignStudentNote fix above)
    const actorOrgId = req.user?.orgId;
    if (actorOrgId && String(note.orgId || "") !== String(actorOrgId)) {
      return sendErr(res, 403, "forbidden");
    }

    if (!note.pdfUrl) return sendErr(res, 400, "note-has-no-pdf");

    // Build the Cloudinary URL to fetch server-side
    let pdfUrl = note.pdfUrl;
    const storedType =
      note.pdfUrl.includes("/raw/authenticated/") ? "authenticated" :
      note.pdfUrl.includes("/raw/private/")       ? "private" :
      note.pdfUrl.includes("/raw/upload/")        ? "upload" :
      NOTES_ACCESS;

    if (storedType === "authenticated") {
      const publicId = note.pdfPublicId || extractPublicIdFromUrl(note.pdfUrl);
      if (publicId) {
        try {
          // Short TTL — the URL is consumed immediately server-side
          pdfUrl = buildAuthenticatedPdfUrl(publicId, { ttl: 120 });
        } catch (e) {
          // CLOUDINARY_AUTH_TOKEN_KEY missing — fall back to stored URL
          console.warn("[notes][streamPdf] buildAuthenticatedPdfUrl failed, using stored URL:", e?.message);
        }
      }
    }

    // Fetch from Cloudinary server-side using Node built-in https/http
    const proto = pdfUrl.startsWith("https") ? https : http;
const options = new URL(pdfUrl);
options.headers = {};

if (req.headers.range) {
  options.headers.Range = req.headers.range;
}

const upstream = proto.get(options, (upRes) => {
      if (upRes.statusCode !== 200 && upRes.statusCode !== 206) {
        upRes.resume(); // drain the socket so it can be reused
        if (!res.headersSent) {
          res.status(502).json({ ok: false, message: "pdf-upstream-error", status: upRes.statusCode });
        }
        return;
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      // Cache privately for 5 minutes — avoids repeated hits for the same viewer session
      res.setHeader("Cache-Control", "private, max-age=300");
      res.statusCode = upRes.statusCode;

if (upRes.headers["content-range"]) {
  res.setHeader("Content-Range", upRes.headers["content-range"]);
}

if (upRes.headers["accept-ranges"]) {
  res.setHeader("Accept-Ranges", upRes.headers["accept-ranges"]);
}

if (upRes.headers["content-length"]) {
  res.setHeader("Content-Length", upRes.headers["content-length"]);
}

      upRes.pipe(res);
    });

    upstream.on("error", (fetchErr) => {
      console.error("[notes][streamPdf] upstream fetch error:", fetchErr?.message);
      if (!res.headersSent) {
        res.status(502).json({ ok: false, message: "pdf-fetch-failed" });
      }
    });
  } catch (err) {
    return next(err);
  }
}