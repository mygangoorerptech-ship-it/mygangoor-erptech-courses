//backend/src/certificates/registry.js
import fs from "fs";
import path from "path";

const candidate1 = path.join(process.cwd(), "templates", "certificates");
const candidate2 = path.join(process.cwd(), "backend", "templates", "certificates");
const TEMPLATES_DIR = fs.existsSync(candidate1) ? candidate1 : candidate2;

/**
 * Load all certificate templates from disk. A template is defined by
 * a folder containing a meta.json file. The meta.json must define at
 * least an `id` and `title`. The loader will attach the absolute
 * directory path as `dir` on the returned object. Invalid folders
 * (missing meta.json) are skipped.
 *
 * @returns {Map<string, any>} a map keyed by template id
 */
export function loadTemplates() {
  const templates = new Map();
  if (!fs.existsSync(TEMPLATES_DIR)) return templates;
  const entries = fs.readdirSync(TEMPLATES_DIR);
  for (const dir of entries) {
    const dirPath = path.join(TEMPLATES_DIR, dir);
    try {
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) continue;
      const metaPath = path.join(dirPath, "meta.json");
      if (!fs.existsSync(metaPath)) continue;
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (!meta || !meta.id) continue;
      templates.set(meta.id, { ...meta, dir: dirPath });
    } catch (e) {
      // Ignore invalid template directories
    }
  }
  return templates;
}