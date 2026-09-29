let API_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5002/api"
    : "https://loancrm.trustingbrains.com/api";

export const CLIENT_PORTAL_URL = "https://loan-crm-saasbased.vercel.app";
export default API_URL;
