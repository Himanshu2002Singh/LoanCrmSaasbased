/**
 * CRM Multi-Tenant Dynamic Theme Management
 * Provides curated preset color palettes and customizable Hex color tokens
 * for primary brand colors, button hover highlights, tables, badges, background, text, and sidebar.
 */

export const DEFAULT_THEME = {
  id: "emerald",
  name: "Emerald Forest (Default)",
  primaryColor: "#047857",
  primaryHoverColor: "#065f46",
  primaryLightColor: "#eef7f2",
  backgroundColor: "#fafbf9",
  surfaceColor: "#ffffff",
  textColor: "#111827",
  textMutedColor: "#64748b",
  sidebarBg: "#101922",
  sidebarText: "#f8fafc",
  sidebarActiveBg: "rgba(4, 120, 87, 0.22)",
  headerBg: "#101922",
  tableRowHoverBg: "#eef7f2",
  activeBadgeBg: "#eef7f2",
  activeBadgeText: "#047857",
};

export const THEME_PRESETS = [
  {
    id: "emerald",
    name: "Emerald Forest",
    badge: "Default CRM",
    primaryColor: "#047857",
    primaryHoverColor: "#065f46",
    primaryLightColor: "#eef7f2",
    backgroundColor: "#fafbf9",
    surfaceColor: "#ffffff",
    textColor: "#111827",
    textMutedColor: "#64748b",
    sidebarBg: "#101922",
    sidebarText: "#f8fafc",
    sidebarActiveBg: "rgba(4, 120, 87, 0.22)",
    headerBg: "#101922",
    tableRowHoverBg: "#eef7f2",
    activeBadgeBg: "#eef7f2",
    activeBadgeText: "#047857",
  },
  {
    id: "sapphire",
    name: "Royal Sapphire Blue",
    badge: "Popular",
    primaryColor: "#2563eb",
    primaryHoverColor: "#1d4ed8",
    primaryLightColor: "#eff6ff",
    backgroundColor: "#f8fafc",
    surfaceColor: "#ffffff",
    textColor: "#0f172a",
    textMutedColor: "#64748b",
    sidebarBg: "#0f172a",
    sidebarText: "#f8fafc",
    sidebarActiveBg: "rgba(37, 99, 235, 0.22)",
    headerBg: "#0f172a",
    tableRowHoverBg: "#eff6ff",
    activeBadgeBg: "#eff6ff",
    activeBadgeText: "#2563eb",
  },
  {
    id: "violet",
    name: "Modern Violet",
    badge: "Tech SaaS",
    primaryColor: "#7c3aed",
    primaryHoverColor: "#6d28d9",
    primaryLightColor: "#f5f3ff",
    backgroundColor: "#faf5ff",
    surfaceColor: "#ffffff",
    textColor: "#1e1b4b",
    textMutedColor: "#6b7280",
    sidebarBg: "#1e1b4b",
    sidebarText: "#f8fafc",
    sidebarActiveBg: "rgba(124, 58, 237, 0.22)",
    headerBg: "#1e1b4b",
    tableRowHoverBg: "#f5f3ff",
    activeBadgeBg: "#f5f3ff",
    activeBadgeText: "#7c3aed",
  },
  {
    id: "teal",
    name: "Ocean Teal",
    badge: "Fresh & Crisp",
    primaryColor: "#0d9488",
    primaryHoverColor: "#0f766e",
    primaryLightColor: "#f0fdfa",
    backgroundColor: "#f4fbfb",
    surfaceColor: "#ffffff",
    textColor: "#134e4a",
    textMutedColor: "#5eead4",
    sidebarBg: "#042f2e",
    sidebarText: "#f0fdfa",
    sidebarActiveBg: "rgba(13, 148, 136, 0.22)",
    headerBg: "#042f2e",
    tableRowHoverBg: "#f0fdfa",
    activeBadgeBg: "#f0fdfa",
    activeBadgeText: "#0d9488",
  },
  {
    id: "crimson",
    name: "Ruby Crimson",
    badge: "Bold & Royal",
    primaryColor: "#be123c",
    primaryHoverColor: "#9f1239",
    primaryLightColor: "#fff1f2",
    backgroundColor: "#fffbfb",
    surfaceColor: "#ffffff",
    textColor: "#1c1917",
    textMutedColor: "#78716c",
    sidebarBg: "#1c1917",
    sidebarText: "#fafaf9",
    sidebarActiveBg: "rgba(190, 18, 60, 0.22)",
    headerBg: "#1c1917",
    tableRowHoverBg: "#fff1f2",
    activeBadgeBg: "#fff1f2",
    activeBadgeText: "#be123c",
  },
  {
    id: "amber",
    name: "Sunset Amber",
    badge: "Warm Copper",
    primaryColor: "#d97706",
    primaryHoverColor: "#b45309",
    primaryLightColor: "#fffbeb",
    backgroundColor: "#fcfbf7",
    surfaceColor: "#ffffff",
    textColor: "#1f2937",
    textMutedColor: "#6b7280",
    sidebarBg: "#1c1917",
    sidebarText: "#fef3c7",
    sidebarActiveBg: "rgba(217, 119, 6, 0.22)",
    headerBg: "#1c1917",
    tableRowHoverBg: "#fffbeb",
    activeBadgeBg: "#fffbeb",
    activeBadgeText: "#d97706",
  },
  {
    id: "dark",
    name: "Midnight Charcoal (Dark)",
    badge: "Dark Theme",
    primaryColor: "#38bdf8",
    primaryHoverColor: "#0284c7",
    primaryLightColor: "#082f49",
    backgroundColor: "#0b0f17",
    surfaceColor: "#131b26",
    textColor: "#f1f5f9",
    textMutedColor: "#94a3b8",
    sidebarBg: "#070b10",
    sidebarText: "#f1f5f9",
    sidebarActiveBg: "rgba(56, 189, 248, 0.22)",
    headerBg: "#070b10",
    tableRowHoverBg: "#172334",
    activeBadgeBg: "#082f49",
    activeBadgeText: "#38bdf8",
  },
  {
    id: "slate",
    name: "Graphite Slate",
    badge: "Minimalist",
    primaryColor: "#475569",
    primaryHoverColor: "#334155",
    primaryLightColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
    surfaceColor: "#ffffff",
    textColor: "#0f172a",
    textMutedColor: "#64748b",
    sidebarBg: "#0f172a",
    sidebarText: "#f8fafc",
    sidebarActiveBg: "rgba(71, 85, 105, 0.22)",
    headerBg: "#0f172a",
    tableRowHoverBg: "#f1f5f9",
    activeBadgeBg: "#f1f5f9",
    activeBadgeText: "#475569",
  },
];

/**
 * Converts Hex (#RRGGBB or #RGB) to rgba(r, g, b, alpha)
 */
export const hexToRgba = (hex, alpha = 1) => {
  if (!hex || typeof hex !== "string") return `rgba(4, 120, 87, ${alpha})`;
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length !== 6) return `rgba(4, 120, 87, ${alpha})`;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(4, 120, 87, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Darkens or lightens a hex color by a percentage (-100 to 100)
 */
export const adjustHexColor = (hex, percent) => {
  if (!hex || typeof hex !== "string") return hex;
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
  if (clean.length !== 6) return hex;
  let num = parseInt(clean, 16);
  let amt = Math.round(2.55 * percent);
  let R = (num >> 16) + amt;
  let G = ((num >> 8) & 0x00ff) + amt;
  let B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 0 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
};

export const generateHoverColor = (hex) => adjustHexColor(hex, -15);

/**
 * Generates a soft pastel background tint by blending the color with white.
 * Produces clean, readable backgrounds for table hovers and badges.
 */
export const generateLightColor = (hex, opacity = 0.12) => {
  if (!hex || typeof hex !== "string") return "#eef7f2";
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
  if (clean.length !== 6) return "#eef7f2";
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#eef7f2";
  const nr = Math.round(r * opacity + 255 * (1 - opacity));
  const ng = Math.round(g * opacity + 255 * (1 - opacity));
  const nb = Math.round(b * opacity + 255 * (1 - opacity));
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
};

export const isValidHex = (hex) => /^#([0-9A-Fa-f]{3}){1,2}$/.test(String(hex || "").trim());

export const getSavedTheme = () => {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = localStorage.getItem("companyTheme");
    if (!stored) return DEFAULT_THEME;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_THEME, ...parsed };
  } catch {
    return DEFAULT_THEME;
  }
};

/**
 * Applies the given theme object to the DOM by setting CSS variables
 * and injecting targeted CSS overrides into the document head.
 */
export const applyTheme = (themeInput) => {
  if (typeof window === "undefined" || !document?.documentElement) return;

  const theme = {
    ...DEFAULT_THEME,
    ...(themeInput || {}),
  };

  const primary = theme.primaryColor || DEFAULT_THEME.primaryColor;
  const primaryHover = theme.primaryHoverColor || generateHoverColor(primary);
  const primaryLight = theme.primaryLightColor || generateLightColor(primary);
  const primaryGlow = hexToRgba(primary, 0.22);
  const primarySoftGlow = hexToRgba(primary, 0.12);
  const bg = theme.backgroundColor || DEFAULT_THEME.backgroundColor;
  const surface = theme.surfaceColor || DEFAULT_THEME.surfaceColor;
  const text = theme.textColor || DEFAULT_THEME.textColor;
  const textMuted = theme.textMutedColor || DEFAULT_THEME.textMutedColor;
  const sidebarBg = theme.sidebarBg || DEFAULT_THEME.sidebarBg;
  const sidebarText = theme.sidebarText || DEFAULT_THEME.sidebarText;
  const sidebarActiveBg = theme.sidebarActiveBg || hexToRgba(primary, 0.22);
  const headerBg = theme.headerBg || sidebarBg;
  const tableRowHover = theme.tableRowHoverBg || primaryLight;
  const tableHeaderBg = theme.tableHeaderBg || "#f8fafc";
  const activeBadgeBg = theme.activeBadgeBg || primaryLight;
  const activeBadgeText = theme.activeBadgeText || primary;

  // Set CSS Custom Properties on :root
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--cc-primary", primary);
  rootStyle.setProperty("--cc-primary-hover", primaryHover);
  rootStyle.setProperty("--cc-primary-light", primaryLight);
  rootStyle.setProperty("--cc-primary-glow", primaryGlow);
  rootStyle.setProperty("--cc-primary-soft-glow", primarySoftGlow);
  rootStyle.setProperty("--cc-green", primary);
  rootStyle.setProperty("--cc-green-dark", primaryHover);
  rootStyle.setProperty("--cc-bg", bg);
  rootStyle.setProperty("--cc-surface", surface);
  rootStyle.setProperty("--cc-ink", text);
  rootStyle.setProperty("--cc-muted", textMuted);
  rootStyle.setProperty("--cc-sidebar-bg", sidebarBg);
  rootStyle.setProperty("--cc-sidebar-text", sidebarText);
  rootStyle.setProperty("--cc-sidebar-active-bg", sidebarActiveBg);
  rootStyle.setProperty("--cc-header-bg", headerBg);
  rootStyle.setProperty("--cc-table-row-hover", tableRowHover);
  rootStyle.setProperty("--cc-table-header-bg", tableHeaderBg);
  rootStyle.setProperty("--cc-active-badge-bg", activeBadgeBg);
  rootStyle.setProperty("--cc-active-badge-text", activeBadgeText);

  // Inject or update the dynamic style tag for comprehensive CRM coverage
  let styleTag = document.getElementById("cc-dynamic-theme-style");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "cc-dynamic-theme-style";
  }
  // Always append at the end of head so it takes highest precedence
  document.head.appendChild(styleTag);

  styleTag.innerHTML = `
    /* CRM Root Dynamic Tokens */
    :root {
      --cc-primary: ${primary};
      --cc-primary-hover: ${primaryHover};
      --cc-primary-light: ${primaryLight};
      --cc-primary-glow: ${primaryGlow};
      --cc-primary-soft-glow: ${primarySoftGlow};
      --cc-green: ${primary} !important;
      --cc-green-dark: ${primaryHover} !important;
      --cc-bg: ${bg};
      --cc-surface: ${surface};
      --cc-ink: ${text};
      --cc-muted: ${textMuted};
      --cc-sidebar-bg: ${sidebarBg};
      --cc-sidebar-text: ${sidebarText};
      --cc-sidebar-active-bg: ${sidebarActiveBg};
      --cc-header-bg: ${headerBg};
      --cc-table-row-hover: ${tableRowHover};
      --cc-active-badge-bg: ${activeBadgeBg};
      --cc-active-badge-text: ${activeBadgeText};
    }

    /* Overall Layout & Background Colors */
    body, .cc-admin, .cc-shell {
      background-color: var(--cc-bg) !important;
      color: var(--cc-ink) !important;
    }

    /* Sidebar Dynamic Styling */
    .cc-sidebar {
      background: var(--cc-sidebar-bg) !important;
      color: var(--cc-sidebar-text) !important;
    }
    .cc-tenant-sub {
      color: var(--cc-primary) !important;
    }
    .cc-nav-chevron-rotated {
      color: var(--cc-primary) !important;
    }
    .cc-sidebar .cc-nav-item {
      color: var(--cc-sidebar-text) !important;
    }
    .cc-sidebar .cc-nav-item:hover {
      background: rgba(255, 255, 255, 0.08) !important;
      color: #ffffff !important;
    }
    .cc-sidebar .cc-nav-item-active {
      background: var(--cc-sidebar-active-bg) !important;
      box-shadow: inset 3px 0 0 var(--cc-primary) !important;
      color: #ffffff !important;
    }
    .cc-sidebar .cc-nav-item-active svg,
    .cc-sidebar .cc-nav-item-active .cc-nav-icon {
      color: var(--cc-primary) !important;
    }
    .cc-nav-group-header-active {
      background: rgba(255, 255, 255, 0.06) !important;
      color: #ffffff !important;
    }
    .cc-nav-group-header-active .cc-nav-icon,
    .cc-nav-group-header-active svg {
      color: var(--cc-primary) !important;
    }
    .cc-sidebar .cc-nav-sub-item-active {
      background: var(--cc-sidebar-active-bg) !important;
      color: var(--cc-primary) !important;
      box-shadow: inset 3px 0 0 var(--cc-primary) !important;
    }
    .cc-sidebar .cc-nav-sub-item-active .cc-sub-icon,
    .cc-sidebar .cc-nav-sub-item-active svg {
      color: var(--cc-primary) !important;
      opacity: 1 !important;
    }
    .cc-sidebar .cc-nav-action-item {
      color: var(--cc-primary) !important;
    }
    .cc-sidebar .cc-nav-action-item .cc-sub-icon,
    .cc-sidebar .cc-nav-action-item svg {
      color: var(--cc-primary) !important;
    }
    .cc-sidebar .cc-nav-action-item:hover {
      background: var(--cc-primary-glow) !important;
      color: #ffffff !important;
    }
    .cc-collapse-btn:focus-visible {
      box-shadow: 0 0 0 2px var(--cc-primary) !important;
    }

    /* Top Sticky Header */
    .cc-header {
      background: var(--cc-header-bg) !important;
    }

    /* Primary Action Buttons (Leads, modals, add-lead, submit, etc.) */
    .cc-add-lead, 
    .cc-comp-btn.primary,
    .cc-btn-primary,
    .cc-leads-btn.primary,
    button.primary,
    button.btn-primary,
    button[class*="bg-emerald-600"],
    button[class*="bg-emerald-700"],
    button[class*="bg-green-600"],
    button[class*="bg-green-700"],
    button[class*="bg-blue-600"],
    button[class*="bg-blue-700"] {
      background-color: var(--cc-primary) !important;
      border-color: var(--cc-primary) !important;
      color: #ffffff !important;
      box-shadow: 0 4px 14px var(--cc-primary-glow) !important;
    }
    .cc-add-lead:hover, 
    .cc-comp-btn.primary:hover,
    .cc-btn-primary:hover,
    .cc-leads-btn.primary:hover,
    button.primary:hover,
    button.btn-primary:hover,
    button[class*="hover:bg-emerald"]:hover,
    button[class*="hover:bg-green"]:hover,
    button[class*="hover:bg-blue"]:hover {
      background-color: var(--cc-primary-hover) !important;
      border-color: var(--cc-primary-hover) !important;
    }

    /* Table Active Category Tabs & Filter Pills (Leads tabs, Operations pipeline pills) */
    .cc-ops-pill.active,
    .cc-leads-category-tabs button.active,
    .cc-leads-category-tabs button[class*="active"],
    .cc-category-tab.active,
    .cc-tab-btn.active,
    .cc-section-followup-work button.active,
    .cc-section-followup-work .cc-followup-card-active {
      background-color: var(--cc-primary) !important;
      border-color: var(--cc-primary) !important;
      color: #ffffff !important;
      box-shadow: 0 4px 12px var(--cc-primary-glow) !important;
    }
    .cc-ops-pill.active *,
    .cc-leads-category-tabs button.active *,
    .cc-section-followup-work .cc-followup-card-active * {
      color: #ffffff !important;
    }
    .cc-leads-category-tabs button:not(.active):hover {
      color: var(--cc-primary) !important;
    }

    /* Table Row Hovers across all tables in the CRM */
    table tbody tr:hover td,
    .cc-leads-table-container tbody tr:hover td,
    .cc-report-table-scroll tbody tr:hover td,
    .cc-section-skin tr:hover td,
    .cc-table-panel tbody tr:hover td,
    .cc-table-scroll tbody tr:hover td,
    .cc-table tbody tr:hover td {
      background-color: var(--cc-table-row-hover) !important;
    }

    /* Table Headers */
    .cc-table-header-themed th,
    .cc-leads-table-container thead th,
    .cc-table-panel thead th {
      background-color: var(--cc-table-header-bg, #f8fafc) !important;
    }

    /* Light Badges, Status Pills & Commission Tags */
    .cc-badge-chip,
    .cc-role-tag.sales,
    .cc-kpi-icon.green,
    .cc-kpi-icon.emerald,
    .cc-dash-kpi-icon.emerald,
    .cc-payout-role-tag,
    .cc-commission-badge,
    .cc-stat-pill.gps-active,
    .cc-leads-assign-btn.assigned,
    [class*="bg-emerald-50"],
    [class*="bg-green-50"],
    [class*="bg-teal-50"],
    [class*="bg-emerald-100"],
    [class*="bg-green-100"] {
      background-color: var(--cc-active-badge-bg) !important;
      color: var(--cc-active-badge-text) !important;
      border-color: var(--cc-primary-glow) !important;
    }

    /* Highlight Values & Icons */
    .cc-dash-kpi-val.emerald,
    .cc-leads-icon-btn:hover,
    .cc-map-link,
    [class*="text-emerald-600"],
    [class*="text-emerald-700"],
    [class*="text-green-600"],
    [class*="text-green-700"] {
      color: var(--cc-primary) !important;
    }

    /* Section Skin Typography & Cards */
    .cc-section-skin h1,
    .cc-section-skin h2,
    .cc-section-skin h3 {
      color: var(--cc-ink) !important;
    }

    /* Form Inputs, Selects & Textareas on Focus */
    input:focus,
    select:focus,
    textarea:focus,
    .cc-section-skin input:focus,
    .cc-section-skin select:focus,
    .cc-section-skin textarea:focus,
    .cc-leads-toolbar .cc-report-search input:focus,
    .cc-perf-field select:focus, 
    .cc-perf-field input:focus,
    .cc-field input:focus,
    .cc-field textarea:focus {
      border-color: var(--cc-primary) !important;
      box-shadow: 0 0 0 3px var(--cc-primary-soft-glow) !important;
      outline: none !important;
    }

    /* Pagination Focus & Hovers */
    .cc-pagination-btn:not(:disabled):hover {
      border-color: var(--cc-primary) !important;
      color: var(--cc-primary) !important;
    }
    .cc-pagination-jump input:focus {
      border-color: var(--cc-primary) !important;
      box-shadow: 0 0 0 3px var(--cc-primary-glow) !important;
    }
  `;
};

/**
 * Saves the theme configuration to localStorage and applies it immediately
 */
export const saveTheme = (themeConfig) => {
  if (typeof window === "undefined") return;
  const merged = { ...DEFAULT_THEME, ...(themeConfig || {}) };
  localStorage.setItem("companyTheme", JSON.stringify(merged));
  applyTheme(merged);
  window.dispatchEvent(new CustomEvent("company_theme_updated", { detail: merged }));
};

/**
 * Resets the active theme to default green & white
 */
export const resetTheme = () => {
  saveTheme(DEFAULT_THEME);
};

/**
 * Application boot initializer: loads stored theme and applies it instantly
 */
export const initTheme = () => {
  const theme = getSavedTheme();
  applyTheme(theme);
  return theme;
};

export default {
  DEFAULT_THEME,
  THEME_PRESETS,
  hexToRgba,
  adjustHexColor,
  generateHoverColor,
  generateLightColor,
  isValidHex,
  getSavedTheme,
  applyTheme,
  saveTheme,
  resetTheme,
  initTheme,
};
