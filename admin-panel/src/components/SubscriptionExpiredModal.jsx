import React, { useEffect, useState } from "react";
import { AlertTriangle, Clock, Headphones, Lock, LogOut, ShieldAlert, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SubscriptionExpiredModal() {
  const [blockedInfo, setBlockedInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleBlocked = (e) => {
      setBlockedInfo(e.detail);
    };

    window.addEventListener("subscription_blocked", handleBlocked);
    return () => window.removeEventListener("subscription_blocked", handleBlocked);
  }, []);

  if (!blockedInfo) return null;

  const isSuspended = blockedInfo.code === "COMPANY_SUSPENDED";
  const title = isSuspended ? "Company Account Suspended" : "Subscription Plan Expired";

  const handleLogout = () => {
    localStorage.clear();
    setBlockedInfo(null);
    navigate("/login", { replace: true });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const dt = new Date(dateStr);
      return !isNaN(dt.getTime())
        ? dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : dateStr;
    } catch {
      return dateStr;
    }
  };

  const formattedExpiry = formatDate(blockedInfo.expiredAt);

  return (
    <div className="cc-sub-overlay">
      <style>{styles}</style>
      <div className="cc-sub-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header Icon */}
        <div className={`cc-sub-icon ${isSuspended ? "suspended" : "expired"}`}>
          {isSuspended ? <ShieldAlert size={36} /> : <Lock size={36} />}
        </div>

        {/* Title */}
        <div className="cc-sub-title">
          <h2>{title}</h2>
          {formattedExpiry && (
            <div className="cc-sub-badge">
              <Clock size={13} />
              <span>Expired on: {formattedExpiry}</span>
            </div>
          )}
        </div>

        {/* Message Box */}
        <div className="cc-sub-msg-box">
          <p>
            {blockedInfo.message ||
              "Your company's CRM subscription plan has expired. System API calls and operations are restricted until the plan is renewed."}
          </p>
        </div>

        {/* Support Note */}
        <div className="cc-sub-support">
          <Headphones size={16} />
          <span>
            Please contact your company administrator or platform support to renew your plan.
          </span>
        </div>

        {/* Actions */}
        <div className="cc-sub-actions">
          <button type="button" className="cc-sub-btn primary" onClick={handleLogout}>
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = `
  .cc-sub-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: grid;
    place-items: center;
    padding: 16px;
    animation: ccSubFadeIn 0.2s ease-out;
  }
  @keyframes ccSubFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .cc-sub-modal {
    background: #ffffff;
    border-radius: 20px;
    padding: 28px 24px;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    animation: ccSubPop 0.2s ease-out;
  }
  @keyframes ccSubPop {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .cc-sub-icon {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    margin-bottom: 16px;
  }
  .cc-sub-icon.expired {
    background: #fff1f2;
    color: #e11d48;
    border: 2px solid #fecdd3;
  }
  .cc-sub-icon.suspended {
    background: #fef2f2;
    color: #dc2626;
    border: 2px solid #fecaca;
  }

  .cc-sub-title h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
  }
  .cc-sub-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 8px;
    padding: 4px 10px;
    border-radius: 999px;
    background: #fff1f2;
    color: #be123c;
    font-size: 12px;
    font-weight: 700;
  }

  .cc-sub-msg-box {
    margin: 16px 0 12px 0;
    padding: 14px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    width: 100%;
    box-sizing: border-box;
  }
  .cc-sub-msg-box p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
    color: #334155;
    font-weight: 500;
  }

  .cc-sub-support {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: #64748b;
    margin-bottom: 20px;
    font-weight: 500;
  }

  .cc-sub-actions {
    width: 100%;
  }
  .cc-sub-btn {
    width: 100%;
    height: 42px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    border: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.15s ease;
  }
  .cc-sub-btn.primary {
    background: #0f172a;
    color: #ffffff;
  }
  .cc-sub-btn.primary:hover {
    background: #1e293b;
    transform: translateY(-1px);
  }
`;
