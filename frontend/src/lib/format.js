export function formatINR(value) {
  try {
    // Handle null, undefined, or empty
    if (value == null || value === "") return "₹ 0";

    // Handle objects - try to extract number
    if (typeof value === "object") {
      if (value.$numberDecimal) {
        value = value.$numberDecimal;
      } else if (value.value) {
        value = value.value;
      } else if (value.amount) {
        value = value.amount;
      } else {
        return "₹ 0";
      }
    }

    // Convert to number
    const num =
      typeof value === "number"
        ? value
        : parseFloat(String(value).replace(/[^0-9.-]/g, ""));

    // Check for NaN
    if (isNaN(num) || !isFinite(num)) return "₹ 0";

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  } catch (err) {
    console.error("formatINR error:", err, value);
    return "₹ 0";
  }
}

export function compactINR(value) {
  const num = typeof value === "number" ? value : parseFloat(value || 0);
  if (num >= 1e7) return `₹ ${(num / 1e7).toFixed(1)}Cr`;
  if (num >= 1e5) return `₹ ${(num / 1e5).toFixed(1)}L`;
  if (num >= 1e3) return `₹ ${(num / 1e3).toFixed(1)}k`;
  return `₹ ${Math.round(num)}`;
}

export function percent(n) {
  return `${Math.round((n || 0) * 100)}%`;
}
