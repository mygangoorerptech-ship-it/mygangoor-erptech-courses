import { useMemo, useState } from "react";
import Modal from "../../components/Modal";
import Button from "../../components/Button";
import { Label, Select } from "../../components/Input";
import { Info, Upload, FileDown, FileSpreadsheet } from "lucide-react";

/** ★ tiny helpers */
const dedupeByValue = (arr: Array<{ value: string; label: string }>) => {
  const m = new Map<string, { value: string; label: string }>();
  for (const o of arr) m.set(String(o.value), o);
  return Array.from(m.values());
};
const asStr = (v: any, fallback = "") => (v == null ? fallback : String(v));

/** Robust CSV parser (handles quotes, escaped double-quotes, commas inside fields) */
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => { row.push(cur); cur = ""; };
  const pushRow = () => { rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") pushCell();
      else if (ch === "\n") { pushCell(); pushRow(); }
      else if (ch === "\r") { /* ignore lone CR */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { pushCell(); pushRow(); }

  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  return rows
    .slice(1)
    .filter(r => r.some(c => String(c).trim().length))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function toBoolean(val: any): boolean {
  const s = String(val ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function splitTags(val: any): string[] {
  if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean);
  const s = String(val ?? "").trim();
  if (!s) return [];
  return s.split(/[|;,]/).map(t => t.trim()).filter(Boolean);
}

function parseChapters(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  const s = String(val).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  const parts = s.split(/[|;]/).map(p => p.trim()).filter(Boolean);
  return parts.map((title, i) => ({ title, order: i }));
}

export default function BulkUploadModal({
  role, orgs, admins, onClose, onImport,
}: {
  role: string;
  orgs: Array<{ label: string; value: string }>;
  admins: Array<{ label: string; value: string }>;
  onClose: () => void;
  onImport: (rows: any[]) => Promise<any>;
}) {
  const isSA = role === "superadmin";

  // ★ Clean option lists for this modal:
  // - Remove "All" entry from orgs (meaningless as a default for import)
  // - Dedupe by value to avoid duplicates after slow/duplicated loads
  const modalOrgOptions = useMemo(
    () =>
      dedupeByValue(
        (orgs || [])
          .filter(o => asStr(o.value).toLowerCase() !== "all")
          .map(o => ({ label: o.label, value: asStr(o.value) }))
      ),
    [orgs]
  );
  const adminOptions = useMemo(
    () => dedupeByValue((admins || []).map(a => ({ label: a.label, value: asStr(a.value) }))),
    [admins]
  );

  // Supported headers (order does not matter)
  const commonHeaders = [
    "title", "slug", "description", "category",
    "price", "visibility", "status", "tags",
    "isBundled", "chapters", "demoVideoUrl",
  ];
  const headers = isSA
    ? [...commonHeaders, "orgId", "ownerEmail"]
    : commonHeaders;

  // For fuzzy matching
  const headerAliases: Record<string, string[]> = {
    orgId: ["org", "organization", "org_id", "orgid"],
    ownerEmail: ["owner", "owner_email"],
    price: ["amount", "price_rs"],
    description: ["desc"],
    demoVideoUrl: ["demo", "demo_url", "demoVideo"],
    isBundled: ["bundle", "isbundled"],
    chapters: ["chapter_list", "chapter_titles"],
    tags: ["tag_list"],
  };

  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ★ normalize to string and prefer "global"
  const [orgId, setOrgId] = useState<string>("global");
  const [ownerEmail, setOwnerEmail] = useState<string>("");

  /** Sample rows (quoted where needed). Prices in ₹ (rupees) — we convert to paise. */
  const sampleRows = useMemo(() => {
    const base = [
      {
        title: "React Basics",
        slug: "react-basics",
        description: "Intro to components, JSX, props/state.",
        category: "Frontend",
        price: "999.00",
        visibility: "public",
        status: "published",
        tags: "react|frontend",
        isBundled: "true",
        chapters: JSON.stringify([{ title: "Intro" }, { title: "JSX" }]),
        demoVideoUrl: "",
      },
      {
        title: "Node Mastery",
        slug: "node-mastery",
        description: "Async patterns, APIs, and performance.",
        category: "Backend",
        price: "1499.00",
        visibility: "public",
        status: "published",
        tags: "node|backend",
        isBundled: "false",
        chapters: "",
        demoVideoUrl: "",
      },
    ];
    if (isSA) {
      return base.map(r => ({ ...r, orgId: "global", ownerEmail: "" }));
    }
    return base;
  }, [isSA]);

  function csvEscape(v: string) {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }

  const sampleCSV = useMemo(() => {
    const head = headers.join(",");
    const lines = sampleRows.map(r =>
      headers.map(h => csvEscape(String((r as any)[h] ?? ""))).join(",")
    );
    return [head, ...lines].join("\n");
  }, [headers, sampleRows]);

  async function parseXLSX(file: File) {
    try {
      const XLSX = await import(/* @vite-ignore */ "xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      const mapKey = (k: string): string => {
        const key = k.trim().toLowerCase();
        for (const canonical of headers) {
          if (key === canonical.toLowerCase()) return canonical;
          const aliases = headerAliases[canonical] || [];
          if (aliases.some(a => a.toLowerCase() === key)) return canonical;
        }
        return k;
      };

      return data.map((row) => {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) out[mapKey(k)] = v;
        return out;
      });
    } catch {
      setError("Failed to read XLSX. Please use the template or upload a valid workbook.");
      return [];
    }
  }

  /** Normalize rows to our API payloads (rupees → paise, tags to string[], chapters parsed, etc.) */
  function normalize(raw: Record<string, any>[]) {
    const normalized: any[] = [];
    for (const r of raw) {
      const pick = (k: string) => {
        if (k in r) return r[k];
        const aliases = headerAliases[k] || [];
        const found = Object.keys(r).find(
          kk => kk.toLowerCase() === k.toLowerCase() || aliases.map(a => a.toLowerCase()).includes(kk.toLowerCase())
        );
        return found ? r[found] : undefined;
      };

      const rupees = Number(String(pick("price") ?? "0").replace(/[^0-9.]/g, "")) || 0;
      const price = Math.round(rupees * 100);

      const visibility = String(pick("visibility") ?? "unlisted").toLowerCase();
      const status = String(pick("status") ?? "draft").toLowerCase();

      const title = String(pick("title") ?? "").trim();
      if (!title) continue;

      const base: any = {
        title,
        slug: (pick("slug") ? String(pick("slug")) : undefined)?.trim().toLowerCase() || undefined,
        description: (pick("description") ? String(pick("description")) : undefined) || undefined,
        category: (pick("category") ? String(pick("category")) : undefined) || undefined,
        price,
        visibility,
        status,
        tags: splitTags(pick("tags")),
        isBundled: toBoolean(pick("isBundled")),
        chapters: parseChapters(pick("chapters")),
        demoVideoUrl: (pick("demoVideoUrl") ? String(pick("demoVideoUrl")) : undefined) || undefined,
      };

      if (isSA) {
        let og = pick("orgId") ?? orgId;
        og = asStr(og).trim();
        base.orgId = !og || og === "global" ? null : og;

        const owner = (pick("ownerEmail") ?? ownerEmail) as string;
        base.ownerEmail = owner ? String(owner).trim().toLowerCase() : undefined;
      }

      if (!base.isBundled && Array.isArray(base.chapters) && base.chapters.length > 0) {
        base.isBundled = true;
      }

      normalized.push(base);
    }
    return normalized;
  }

  const handleFile = async (file: File) => {
    setParsing(true);
    setError(null);
    setFileName(file.name);
    try {
      let parsed: any[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        parsed = parseCSV(await file.text());
      } else if (/\.(xlsx|xlsm)$/i.test(file.name)) {
        parsed = await parseXLSX(file);
      } else {
        setError("Unsupported file type. Please upload CSV or XLSX.");
        setParsing(false);
        return;
      }
      setRows(normalize(parsed));
    } catch {
      setError("Could not parse the file. Please verify the columns and try again.");
    } finally {
      setParsing(false);
    }
  };

  const downloadCSV = () => {
    const blob = new Blob([sampleCSV], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = isSA ? "courses_template_superadmin.csv" : "courses_template_admin.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadXLSX = async () => {
    try {
      const XLSX = await import(/* @vite-ignore */ "xlsx");
      const head = [headers];
      const rows = sampleRows.map(r => headers.map(h => (r as any)[h] ?? ""));
      const ws = XLSX.utils.aoa_to_sheet([...head, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = isSA ? "courses_template_superadmin.xlsx" : "courses_template_admin.xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      alert("XLSX generator not available. Please use CSV template instead.");
    }
  };

  const canImport = rows.length > 0;

  return (
    <Modal open title="Bulk Upload Courses" onClose={onClose}>
      <div className="w-[92vw] max-w-4xl space-y-4">
        <div className="rounded-lg border p-3 bg-slate-50 text-slate-700 flex items-start gap-2">
          <Info size={18} className="mt-0.5" />
          <div className="text-sm leading-relaxed">
            <div>Upload a CSV or XLSX file. <strong>Column order doesn’t matter</strong>.</div>
            <div className="mt-1">Supported columns:</div>
            <div className="font-mono text-xs mt-1 break-words">
              {headers.join(", ")}
            </div>
            <ul className="text-xs mt-2 list-disc pl-5 space-y-1">
              <li><strong>price</strong> in ₹ (rupees). We convert to paise.</li>
              <li><strong>tags</strong> can be separated by <code>|</code>, <code>,</code> or <code>;</code>.</li>
              <li><strong>isBundled</strong>: true/false. If empty but <strong>chapters</strong> provided, we infer true.</li>
              <li><strong>chapters</strong>: either JSON array (e.g. <code>[{"{"}"title":"Intro"{"}"}]</code>) or <code>Title1|Title2|Title3</code>.</li>
              {isSA && <li><strong>orgId</strong>: set <code>global</code> for global courses, otherwise use an Organization ID.</li>}
            </ul>
          </div>
        </div>

        {isSA && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Default Organization (for rows missing orgId)</Label>
              <Select
                value={orgId}
                onChange={(e) => setOrgId(asStr(e.target.value, "global"))}
              >
                {modalOrgOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Default Owner (Admin)</Label>
              <Select
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              >
                <option value="">None</option>
                {adminOptions.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadCSV}><FileDown size={16}/> Download CSV Template</Button>
          <Button variant="secondary" onClick={downloadXLSX}><FileSpreadsheet size={16}/> Download XLSX Template</Button>
        </div>

        <div className="rounded-xl border border-dashed p-4 text-center bg-white">
          <input
            id="bulk-file"
            type="file"
            accept=".csv,.xlsx,.xlsm"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <label htmlFor="bulk-file" className="cursor-pointer inline-flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-slate-50">
            <Upload size={16}/> {fileName ? "Choose another file" : "Choose CSV/XLSX file"}
          </label>
          {fileName && <div className="text-xs text-slate-500 mt-2">Selected: {fileName}</div>}
          {parsing && <div className="text-sm text-slate-600 mt-2">Parsing…</div>}
          {error && <div className="text-sm text-rose-600 mt-2">{error}</div>}
        </div>

        {rows.length > 0 && (
          <div className="rounded-lg border max-h-64 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50">
                <tr>{headers.map(h => <th key={h} className="text-left font-medium p-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t">
                    {headers.map(h => (
                      <td key={h} className="p-2 align-top">
                        {Array.isArray((r as any)[h])
                          ? (r as any)[h].join(" | ")
                          : String((r as any)[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 100 && (
              <div className="text-[11px] text-slate-500 p-2">
                Showing first 100 rows of {rows.length}…
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={() => onImport(rows)} disabled={!rows.length}>
            <Upload size={16}/> Import {rows.length ? `(${rows.length})` : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
