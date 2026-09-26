import API_URL from "../config";

/**
 * Resolves a company logo path or URL to an absolute URL that can be loaded in <img> tags.
 * Handles relative paths (/uploads/logos/...), full http/https URLs, and data/blob URLs.
 */
export const resolveLogoUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  // API_URL is e.g. "http://localhost:5002/api" or "https://loancrm.trustingbrains.com/api"
  const baseUrl = API_URL.replace(/\/api\/?$/, "");
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${baseUrl}${normalizedPath}`;
};

export default resolveLogoUrl;
