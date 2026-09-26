// let API_URL = "http://51.20.76.55:5000/api";
let API_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5002/api"
    : "https://loancrm.trustingbrains.com/api";
// let API_URL = "http://72.62.197.59:3006/api";
export default API_URL;
