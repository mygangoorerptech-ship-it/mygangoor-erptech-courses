//backend/src/controllers/organizationsController.js
import Organization from "../models/Organization.js";
import * as XLSX from "xlsx";

const ALLOWED = [
  "code","name","domain",
  "contactName","contactEmail","phone",
  "address","city","state","country","postal","notes",
  "status"
];
const pick = (o, keys) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => keys.includes(k)));

// NEW: return minimal, safe info for any authed user
export async function brief(req, res) {
  const id = req.params.id;
  const doc = await Organization.findById(id)
    .select("name code status deletedAt") // only safe fields
    .lean();

  if (!doc || doc.deletedAt) {
    return res.status(404).json({ ok: false, message: "Organization not found" });
  }

  return res.json({
    ok: true,
    organization: {
      id: String(doc._id),
      name: doc.name,
      code: doc.code,
      status: doc.status,
    },
  });
}


export async function list(req, res) {
  const { q, status, suspended } = req.query;
  const where = { deletedAt: null };
 if (status) {
   if (["active","inactive"].includes(status)) {
     where.status = status;
   } else if (status === "suspended") {
     // match either the string status or legacy boolean
     where.$or = [...(where.$or || []), { status: "suspended" }, { suspended: true }];
   }
 }
  if (typeof suspended !== "undefined") where.suspended = suspended === "true";

  
  // ---- Conditional ETag support to avoid unnecessary full reads ----
  try {
    const count = await Organization.countDocuments(where);
    const lastDoc = await Organization.findOne(where).sort({ updatedAt: -1 }).select({ updatedAt: 1 }).lean();
    const last = lastDoc?.updatedAt ? new Date(lastDoc.updatedAt).getTime() : 0;
    const vKey = `${count}:${last}:${status || 'all'}:${suspended ?? 'any'}:${q || ''}`;
    const etag = `W/"orgs-${vKey}"`;
    res.setHeader('ETag', etag);
    res.setHeader('X-Data-Version', vKey);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
  } catch (e) {
    // if version check fails, continue to full fetch
  }
if (q) {
    const rx = new RegExp(String(q).trim(), "i");
   const searchOr = [
     { name: rx }, { code: rx }, { domain: rx },
     { contactName: rx }, { contactEmail: rx }, { phone: rx }
   ];
   where.$or = where.$or ? [...where.$or, ...searchOr] : searchOr;
  }

  const items = await Organization.find(where).sort({ createdAt: -1 }).lean();
  const total = await Organization.countDocuments(where);
  res.json({ ok: true, items, total });
}

export async function create(req, res) {
  const body = pick(req.body, ALLOWED);
  if (!body.code || !body.name) {
    return res.status(400).json({ ok: false, message: "code and name are required" });
  }
  const doc = await Organization.create({ ...body, deletedAt: null });
  res.status(201).json({ ok: true, organization: doc });
}

export async function update(req, res) {
  const patch = pick(req.body, ALLOWED);
  const doc = await Organization.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true });
  res.json({ ok: true, organization: doc });
}

export async function setStatus(req, res) {
  const { status } = req.body;
  if (!["active","inactive","suspended"].includes(status)) {
    return res.status(400).json({ ok: false, message: "Invalid status" });
  }
 const doc = await Organization.findByIdAndUpdate(
   req.params.id,
   { $set: { status, suspended: status === "suspended" } },
   { new: true }
 );
  res.json({ ok: true, organization: doc });
}

export async function suspend(req, res) {
  const { suspend } = req.body;
  const doc = await Organization.findByIdAndUpdate(
    req.params.id,
    { $set: { suspended: !!suspend, status: suspend ? "suspended" : "inactive" } },
    { new: true }
  );
  res.json({ ok: true, organization: doc });
}

export async function destroy(req, res) {
  await Organization.findByIdAndUpdate(req.params.id, { $set: { deletedAt: new Date() } });
  res.json({ ok: true });
}

// ---- shared helpers ----
const STATUS = new Set(["active", "inactive", "suspended"]);

function normalizeRow(raw = {}) {
  const pick = (v) => (typeof v === "string" ? v.trim() : v ?? undefined);

  let code = pick(raw.code);
  let name = pick(raw.name);
  let domain = pick(raw.domain);
  const contactName = pick(raw.contactName);
  const contactEmail = pick(raw.contactEmail);
  let status = pick(raw.status)?.toLowerCase();

  // coarse normalization
  if (domain) domain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!STATUS.has(status)) status = "active";

  return { code, name, domain, contactName, contactEmail, status };
}

function isRowEmpty(r) {
  return !r.code && !r.name && !r.domain;
}

// very small CSV parser that handles quotes and commas
function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length > 0);
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const map = {
    code: "code", name: "name", domain: "domain",
    contactname: "contactName", contactemail: "contactEmail", status: "status",
  };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const obj = {};
    header.forEach((h, j) => {
      const key = map[h] || h;
      obj[key] = (cells[j] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}
function splitCsvLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else { q = !q; } }
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur); return out;
}

async function upsertOne(row, { session } = {}) {
  // 1) Look up by ANY provided key (avoids duplicate-key inserts)
  const ors = [];
  if (row.code)   ors.push({ code: row.code });
  if (row.domain) ors.push({ domain: row.domain });
  if (row.name)   ors.push({ name: row.name });
  if (!ors.length) throw new Error("Missing unique key (code/domain/name)");

  const existing = await Organization.findOne({ $or: ors }).session?.(session);

  // Prepare update payload
  const set = { status: row.status, updatedAt: new Date() };
  for (const k of ["code","name","domain","contactName","contactEmail","phone","address","city","state","country","postal","notes"]) {
    if (row[k] != null && row[k] !== "") set[k] = row[k];
  }

  if (existing) {
    const updated = await Organization.findByIdAndUpdate(
      existing._id,
      { $set: set },
      { new: true, session }
    );
    return { id: updated?._id, wasUpserted: false, doc: updated };
  }

  // Insert new
  const toCreate = {
    ...set,
    createdAt: new Date(),
    deletedAt: null,
  };
  // ensure identifiers are present on insert
  for (const k of ["code","name","domain"]) {
    if (row[k] != null && row[k] !== "") toCreate[k] = row[k];
  }

  const created = await Organization.create([toCreate], { session });
  return { id: created[0]?._id, wasUpserted: true, doc: created[0] };
}

// ---- controllers ----
export async function bulkUpsert(req, res, next) {
  try {
    const inRows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const prepared = inRows.map(normalizeRow).filter(r => !isRowEmpty(r));

    const seen = new Set(); // avoid duplicate payload rows by key
    const uniq = [];
    for (const r of prepared) {
      const key = r.code || `domain:${r.domain}` || `name:${r.name}`;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(r);
    }

    const results = [];
    let created = 0, updated = 0, skipped = 0, errors = 0;

    for (const r of uniq) {
      try {
        const { wasUpserted } = await upsertOne(r);
        if (wasUpserted) created++; else updated++;
        results.push({ ok: true, key: r.code || r.domain || r.name, created: wasUpserted });
      } catch (e) {
        errors++;
        results.push({ ok: false, key: r.code || r.domain || r.name, error: e.message });
      }
    }

    const summary = { count: uniq.length, created, updated, skipped, errors };
    return res.json({ ok: true, summary, results });
  } catch (err) {
    next(err);
  }
}

export async function bulkUploadFile(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "file is required" });

    const mime = req.file.mimetype || "";
    const name = req.file.originalname?.toLowerCase() || "";
    let rows;

    if (name.endsWith(".xlsx") || mime.includes("sheet")) {
      // parse first sheet to JSON-like rows
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    } else {
      // assume CSV
      const text = req.file.buffer.toString("utf8");
      rows = parseCsv(text);
    }

    // normalize and filter empties
    const normalized = rows.map(normalizeRow).filter(r => !isRowEmpty(r));
    if (!normalized.length) {
      return res.status(400).json({ ok: false, error: "No valid rows in file" });
    }

    // You can either: (A) return normalized rows for client preview, or (B) upsert right away.
    // We upsert directly here for simplicity:
    const results = [];
    let created = 0, updated = 0, skipped = 0, errors = 0;

    const seen = new Set();
    for (const r of normalized) {
      const key = r.code || `domain:${r.domain}` || `name:${r.name}`;
      if (!key) { skipped++; continue; }
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);
      try {
        const { wasUpserted } = await upsertOne(r);
        if (wasUpserted) created++; else updated++;
        results.push({ ok: true, key, created: wasUpserted });
      } catch (e) {
        errors++;
        results.push({ ok: false, key, error: e.message });
      }
    }

    const summary = { count: normalized.length, created, updated, skipped, errors };
    return res.json({ ok: true, summary, results });
  } catch (err) {
    next(err);
  }
}

export async function template(req, res) {
  const ext = (req.params.ext || req.query.format || "csv").toString().toLowerCase();
  const rows = [
    { code: "org-101", name: "Alpha Academy", domain: "alpha.example", contactName: "Alpha Owner", contactEmail: "owner@alpha.example", status: "active" },
    { code: "org-202", name: "Beta Learning",  domain: "beta.example",  contactName: "Beta Owner",  contactEmail: "owner@beta.example",  status: "active" },
  ];
  if (ext === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Organizations");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"organizations_template.xlsx\"");
    return res.send(buf);
  }
  // csv fallback
  const header = "code,name,domain,contactName,contactEmail,status";
  const lines = rows.map(r => [r.code, r.name, r.domain, r.contactName, r.contactEmail, r.status]
    .map(v => {
      const s = (v ?? "").toString();
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","));
  const csv = [header, ...lines].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"organizations_template.csv\"");
  return res.send(csv);
}
