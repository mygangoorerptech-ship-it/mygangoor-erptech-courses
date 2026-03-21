// backend/src/utils/safeRegex.js
// Sanitize user-supplied search strings before use in MongoDB $regex.
// Prevents ReDoS via catastrophic backtracking (H-4 fix).

/**
 * Escape all regex metacharacters and enforce a max length.
 * @param {unknown} q    - Raw query input from the request
 * @param {number}  maxLen - Maximum characters allowed (default 100)
 * @returns {string} Safe, escaped string for use in { $regex: ... }
 */
export function safeRegex(q, maxLen = 100) {
  const s = String(q ?? "").slice(0, maxLen);
  // Escape every regex metacharacter so the string is treated as a literal
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
