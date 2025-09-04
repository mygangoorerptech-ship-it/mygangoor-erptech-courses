// backend/src/config/platform.js
export const DEFAULT_PLATFORM_FEE_PAISE = Number.parseInt(process.env.DEFAULT_PLATFORM_FEE_PAISE ?? "4900", 10); // ₹49.00
export function getPlatformFeePaise() {
  const n = Number.isFinite(DEFAULT_PLATFORM_FEE_PAISE) ? DEFAULT_PLATFORM_FEE_PAISE : 0;
  return n >= 0 ? n : 0;
}
