import React from "react";

export function CrmLogo({ markOnly = false, className = "", height = 38 }) {
  if (markOnly) {
    return (
      <div
        className={`crm-logo-mark ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: `${height}px`,
        }}
      >
        <svg
          width={height}
          height={height}
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="crmMarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
            <linearGradient id="crmAccent" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10B981" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Rounded Hexagon Base */}
          <rect
            x="2"
            y="2"
            width="40"
            height="40"
            rx="11"
            fill="url(#crmMarkGrad)"
            filter="url(#glow)"
          />
          <rect
            x="2.75"
            y="2.75"
            width="38.5"
            height="38.5"
            rx="10.25"
            stroke="url(#crmAccent)"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />

          {/* Stylized CRM Graphic Node Motif */}
          <path
            d="M13 22C13 17.0294 17.0294 13 22 13C25.4 13 28.3 14.9 29.8 17.6"
            stroke="#FFFFFF"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M13 22C13 26.9706 17.0294 31 22 31C25.4 31 28.3 29.1 29.8 26.4"
            stroke="#FFFFFF"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="22" cy="22" r="3.2" fill="url(#crmAccent)" />
          <circle cx="30" cy="18" r="2.2" fill="#FFFFFF" />
          <circle cx="30" cy="26" r="2.2" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`crm-logo-full ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "11px",
        textDecoration: "none",
      }}
    >
      <svg
        width={height}
        height={height}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="crmLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="crmAccentFull" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
          <filter id="glowFull" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10B981" floodOpacity="0.4" />
          </filter>
        </defs>

        <rect
          x="2"
          y="2"
          width="40"
          height="40"
          rx="11"
          fill="url(#crmLogoGrad)"
          filter="url(#glowFull)"
        />
        <rect
          x="2.75"
          y="2.75"
          width="38.5"
          height="38.5"
          rx="10.25"
          stroke="url(#crmAccentFull)"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />

        <path
          d="M13 22C13 17.0294 17.0294 13 22 13C25.4 13 28.3 14.9 29.8 17.6"
          stroke="#FFFFFF"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M13 22C13 26.9706 17.0294 31 22 31C25.4 31 28.3 29.1 29.8 26.4"
          stroke="#FFFFFF"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="22" cy="22" r="3.2" fill="url(#crmAccentFull)" />
        <circle cx="30" cy="18" r="2.2" fill="#FFFFFF" />
        <circle cx="30" cy="26" r="2.2" fill="#FFFFFF" />
      </svg>

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", lineHeight: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontSize: "22px",
              fontWeight: "900",
              letterSpacing: "0.04em",
              color: "#FFFFFF",
              fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            CRM
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: "800",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "linear-gradient(135deg, #10B981, #047857)",
              color: "#FFFFFF",
            }}
          >
            PRO
          </span>
        </div>
        <span
          style={{
            fontSize: "10px",
            fontWeight: "600",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.65)",
            marginTop: "3px",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          Enterprise Portal
        </span>
      </div>
    </div>
  );
}

export default CrmLogo;
