import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'
import { StatusProvider } from './contexts/StatusContext.jsx'

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      const data = error.response.data;
      if (
        data?.code === "SUBSCRIPTION_EXPIRED" ||
        data?.code === "COMPANY_SUSPENDED" ||
        (data?.message && typeof data.message === "string" && data.message.toLowerCase().includes("subscription has expired"))
      ) {
        window.dispatchEvent(
          new CustomEvent("subscription_blocked", {
            detail: {
              code: data?.code || "SUBSCRIPTION_EXPIRED",
              message: data?.message || "Your company subscription has expired.",
              expiredAt: data?.expiredAt || null,
              planStatus: data?.planStatus || "expired",
            },
          })
        );
      }
    }
    return Promise.reject(error);
  }
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StatusProvider>
      <App />
    </StatusProvider>
  </StrictMode>,
)
