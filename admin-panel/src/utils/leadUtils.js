/**
 * Central Lead Utilities for formatting Month-wise Company-wise sequential Lead Codes
 * and compact Indian currency displays across the entire CRM.
 */

export const formatLeadCode = (lead) => {
  if (!lead) return "--";
  if (typeof lead === "string") {
    const trimmed = lead.trim();
    if (/^[A-Z]{3}\d{2}-\d{3}$/i.test(trimmed)) return trimmed.toUpperCase();
    if (!isNaN(Number(trimmed)) && Number(trimmed) > 0) {
      // Numerical ID fallback
      const now = new Date();
      const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const mStr = monthNames[now.getMonth()] || "OCT";
      const yStr = String(now.getFullYear()).slice(-2) || "26";
      return `${mStr}${yStr}-${String(trimmed).padStart(3, "0")}`;
    }
  }
  if (typeof lead === "number") {
    const now = new Date();
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const mStr = monthNames[now.getMonth()] || "OCT";
    const yStr = String(now.getFullYear()).slice(-2) || "26";
    return `${mStr}${yStr}-${String(lead).padStart(3, "0")}`;
  }

  if (lead.lead_code) return lead.lead_code;
  if (lead.leadCode) return lead.leadCode;

  const rawDate = lead.createdAt || lead.created_at || lead.date || new Date();
  const d = new Date(rawDate);
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mStr = monthNames[isNaN(d.getMonth()) ? 9 : d.getMonth()] || "OCT";
  const y = isNaN(d.getFullYear()) ? 26 : d.getFullYear();
  const yStr = String(y).slice(-2) || "26";
  const numVal = lead.month_sequence ?? lead.monthSequence ?? lead.lead_id ?? lead.id ?? 1;
  const countStr = String(numVal).padStart(3, "0");
  return `${mStr}${yStr}-${countStr}`;
};

export const formatCurrencyCompact = (val) => {
  const num = parseFloat(val);
  if (!num || isNaN(num) || num <= 0) return "₹0.00 L";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${Math.round(num).toLocaleString("en-IN")}`;
};
