// Simple currency helpers for INR

export function formatINR(
  value: number | null | undefined,
  opts: { maximumFractionDigits?: number } = {}
): string {
  if (value == null || Number.isNaN(Number(value))) return "₹0";
  const v = Number(value);
  const { maximumFractionDigits = 0 } = opts;

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits,
    }).format(v);
  } catch {
    // Fallback if Intl not available for some reason
    const rounded = Math.round(v);
    return `₹${rounded.toLocaleString("en-IN")}`;
  }
}
