import React, { useEffect, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  LayoutDashboard,
  Layers,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Sliders,
  X,
} from "lucide-react";

import API_URL from "../config";
import {
  DEFAULT_THEME,
  THEME_PRESETS,
  applyTheme,
  generateHoverColor,
  generateLightColor,
  getSavedTheme,
  hexToRgba,
  isValidHex,
  saveTheme,
} from "../utils/theme";

export default function ThemeCustomizerModal({
  isOpen,
  onClose,
  initialTheme = null,
  onThemeSaved = null,
}) {
  const [activeTab, setActiveTab] = useState("presets"); // "presets" | "custom"
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [originalTheme, setOriginalTheme] = useState(DEFAULT_THEME);
  const [livePanelPreview, setLivePanelPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize theme state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const current = initialTheme || getSavedTheme();
      setTheme(current);
      setOriginalTheme(current);
      setLivePanelPreview(false);
    }
  }, [isOpen, initialTheme]);

  // When live preview toggle is enabled, apply to entire DOM
  useEffect(() => {
    if (isOpen && livePanelPreview) {
      applyTheme(theme);
    }
  }, [theme, livePanelPreview, isOpen]);

  // Handle modal close & revert live preview if unsaved
  const handleClose = () => {
    if (livePanelPreview) {
      applyTheme(originalTheme);
    }
    onClose();
  };

  if (!isOpen) return null;

  // Select a preset palette
  const handleSelectPreset = (preset) => {
    const updated = {
      ...preset,
      id: preset.id,
      name: preset.name,
    };
    setTheme(updated);
    if (livePanelPreview) {
      applyTheme(updated);
    }
  };

  // Update a specific color property
  const handleColorChange = (key, value) => {
    const updated = {
      ...theme,
      [key]: value,
      id: "custom",
      name: "Custom Palette",
    };

    // Automatically derive hover, light tint, table row hover, badge colors if primaryColor changed
    if (key === "primaryColor" && isValidHex(value)) {
      if (!theme.customHoverExplicit) {
        updated.primaryHoverColor = generateHoverColor(value);
      }
      const light = generateLightColor(value);
      if (!theme.customLightExplicit) {
        updated.primaryLightColor = light;
      }
      if (!theme.customTableHoverExplicit) {
        updated.tableRowHoverBg = light;
      }
      if (!theme.customBadgeBgExplicit) {
        updated.activeBadgeBg = light;
      }
      if (!theme.customBadgeTextExplicit) {
        updated.activeBadgeText = value;
      }
      if (!theme.customSidebarActiveExplicit) {
        updated.sidebarActiveBg = hexToRgba(value, 0.22);
      }
    }

    setTheme(updated);
    if (livePanelPreview) {
      applyTheme(updated);
    }
  };

  // Reset to default green & white
  const handleResetToDefault = () => {
    setTheme(DEFAULT_THEME);
    if (livePanelPreview) {
      applyTheme(DEFAULT_THEME);
    }
    toast.info("Colors reset to default CRM Green & White.");
  };

  // Save theme to server and localStorage
  const handleSaveTheme = async () => {
    try {
      setSaving(true);
      await axios.put(`${API_URL}/company/profile`, {
        themeConfig: theme,
      });

      // Persist locally & notify app components
      saveTheme(theme);
      setOriginalTheme(theme);

      toast.success("Company panel color theme updated successfully!");
      if (typeof onThemeSaved === "function") {
        onThemeSaved(theme);
      }
      window.dispatchEvent(new Event("company_profile_updated"));
      onClose();
    } catch (error) {
      console.error("Failed to save theme:", error);
      toast.error(error.response?.data?.message || "Failed to save theme settings");
    } finally {
      setSaving(false);
    }
  };

  const isCurrentPreset = (presetId) => {
    if (theme.id === presetId) return true;
    const match = THEME_PRESETS.find((p) => p.id === presetId);
    if (!match) return false;
    return (
      theme.primaryColor?.toLowerCase() === match.primaryColor?.toLowerCase() &&
      theme.backgroundColor?.toLowerCase() === match.backgroundColor?.toLowerCase() &&
      theme.sidebarBg?.toLowerCase() === match.sidebarBg?.toLowerCase()
    );
  };

  return (
    <div
      className="cc-theme-modal-backdrop"
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto",
      }}
    >
      <div
        className="cc-theme-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "960px",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          fontFamily: "inherit",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: `linear-gradient(135deg, ${theme.primaryColor || "#047857"}, ${theme.primaryHoverColor || "#065f46"})`,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 4px 12px ${hexToRgba(theme.primaryColor || "#047857", 0.3)}`,
              }}
            >
              <Palette size={22} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "19px",
                  fontWeight: 750,
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                Panel Branding & Color Customization
              </h2>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
                Select a curated color palette or enter exact Hex codes for buttons, highlights, background, and text.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: "8px",
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#475569",
              transition: "background 0.15s",
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs & Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 24px",
            background: "#f8fafc",
            borderBottom: "1px solid #edf2f7",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("presets")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 650,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "7px",
                transition: "all 0.15s",
                background: activeTab === "presets" ? theme.primaryColor || "#047857" : "transparent",
                color: activeTab === "presets" ? "#ffffff" : "#475569",
                boxShadow:
                  activeTab === "presets"
                    ? `0 2px 8px ${hexToRgba(theme.primaryColor || "#047857", 0.3)}`
                    : "none",
              }}
            >
              <Sparkles size={15} /> Preset Palettes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 650,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "7px",
                transition: "all 0.15s",
                background: activeTab === "custom" ? theme.primaryColor || "#047857" : "transparent",
                color: activeTab === "custom" ? "#ffffff" : "#475569",
                boxShadow:
                  activeTab === "custom"
                    ? `0 2px 8px ${hexToRgba(theme.primaryColor || "#047857", 0.3)}`
                    : "none",
              }}
            >
              <Sliders size={15} /> Custom Color Picker & Hex Codes
            </button>
          </div>

          {/* Live Full Panel Preview Toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#334155",
              background: "#ffffff",
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
            }}
          >
            <input
              type="checkbox"
              checked={livePanelPreview}
              onChange={(e) => {
                const checked = e.target.checked;
                setLivePanelPreview(checked);
                if (checked) {
                  applyTheme(theme);
                } else {
                  applyTheme(originalTheme);
                }
              }}
              style={{ cursor: "pointer", accentColor: theme.primaryColor || "#047857" }}
            />
            <Eye size={14} color={livePanelPreview ? theme.primaryColor : "#64748b"} />
            Preview live on entire panel
          </label>
        </div>

        {/* Modal Body: Left Controls & Right Live Preview */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            flex: 1,
            overflowY: "auto",
            minHeight: "420px",
          }}
        >
          {/* Main Controls Panel */}
          <div style={{ padding: "24px", overflowY: "auto" }}>
            {activeTab === "presets" ? (
              <div>
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
                    Curated Color Palettes
                  </h3>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
                    Click any palette to instantly apply it. You can further customize each color below.
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {THEME_PRESETS.map((preset) => {
                    const isSelected = isCurrentPreset(preset.id);
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        style={{
                          borderRadius: "12px",
                          border: isSelected
                            ? `2px solid ${preset.primaryColor}`
                            : "1.5px solid #e2e8f0",
                          background: isSelected ? "#f8fafc" : "#ffffff",
                          padding: "14px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          position: "relative",
                          boxShadow: isSelected
                            ? `0 6px 16px ${hexToRgba(preset.primaryColor, 0.16)}`
                            : "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "10px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                              style={{
                                fontSize: "13.5px",
                                fontWeight: 700,
                                color: "#0f172a",
                              }}
                            >
                              {preset.name}
                            </span>
                            {preset.badge && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: hexToRgba(preset.primaryColor, 0.12),
                                  color: preset.primaryColor,
                                }}
                              >
                                {preset.badge}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <div
                              style={{
                                width: "20px",
                                height: "20px",
                                borderRadius: "50%",
                                background: preset.primaryColor,
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>

                        {/* Swatches Row */}
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <div
                            title={`Primary Brand: ${preset.primaryColor}`}
                            style={{
                              flex: 1,
                              height: "28px",
                              borderRadius: "6px",
                              background: preset.primaryColor,
                              border: "1px solid rgba(0,0,0,0.08)",
                            }}
                          />
                          <div
                            title={`Hover Highlight: ${preset.primaryHoverColor}`}
                            style={{
                              width: "32px",
                              height: "28px",
                              borderRadius: "6px",
                              background: preset.primaryHoverColor,
                              border: "1px solid rgba(0,0,0,0.08)",
                            }}
                          />
                          <div
                            title={`Sidebar: ${preset.sidebarBg}`}
                            style={{
                              width: "32px",
                              height: "28px",
                              borderRadius: "6px",
                              background: preset.sidebarBg,
                              border: "1px solid rgba(0,0,0,0.08)",
                            }}
                          />
                          <div
                            title={`Panel Background: ${preset.backgroundColor}`}
                            style={{
                              width: "32px",
                              height: "28px",
                              borderRadius: "6px",
                              background: preset.backgroundColor,
                              border: "1px solid rgba(0,0,0,0.15)",
                            }}
                          />
                          <div
                            title={`Text: ${preset.textColor}`}
                            style={{
                              width: "32px",
                              height: "28px",
                              borderRadius: "6px",
                              background: preset.textColor,
                              border: "1px solid rgba(0,0,0,0.08)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
                    Detailed Color Control &amp; Custom Hex Codes
                  </h3>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
                    Select any color using the color picker swatch or type your company's official Hex code (e.g. #047857 or #d97706).
                  </p>
                </div>

                <div style={{ display: "grid", gap: "24px" }}>
                  {/* SECTION 1: PRIMARY BUTTONS & ACTIONS */}
                  <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ marginBottom: "14px", paddingBottom: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "12px", fontWeight: 750, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        1. Buttons, Highlights &amp; Primary Actions
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: "14px" }}>
                      <ColorField
                        label="Primary Brand Color (Buttons &amp; Highlights)"
                        description="Replaces default green color for action buttons (+ Add Lead), active tabs, filters &amp; borders."
                        value={theme.primaryColor || "#047857"}
                        onChange={(val) => handleColorChange("primaryColor", val)}
                      />

                      <ColorField
                        label="Button Hover &amp; Focus Highlight"
                        description="The darker highlight shade applied when hovering over buttons, tabs, or links."
                        value={theme.primaryHoverColor || "#065f46"}
                        onChange={(val) => {
                          setTheme((prev) => ({ ...prev, customHoverExplicit: true }));
                          handleColorChange("primaryHoverColor", val);
                        }}
                      />
                    </div>
                  </div>

                  {/* SECTION 2: TABLES, ROW HOVERS & BADGES */}
                  <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ marginBottom: "14px", paddingBottom: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "12px", fontWeight: 750, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        2. Tables, Row Hovers, Badges &amp; Tags
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: "14px" }}>
                      <ColorField
                        label="Table Row Hover &amp; Selection Background"
                        description="Background color applied when hovering over rows in Leads table, Reports &amp; case lists."
                        value={theme.tableRowHoverBg || theme.primaryLightColor || "#eef7f2"}
                        onChange={(val) => {
                          setTheme((prev) => ({ ...prev, customTableHoverExplicit: true }));
                          handleColorChange("tableRowHoverBg", val);
                        }}
                      />

                      <ColorField
                        label="Table Column Headers Background"
                        description="Background color for table header columns across all CRM data grids (Default: #f8fafc)."
                        value={theme.tableHeaderBg || "#f8fafc"}
                        onChange={(val) => handleColorChange("tableHeaderBg", val)}
                      />

                      <ColorField
                        label="Badges, Status Tags &amp; Commission Background"
                        description="Background shade for commission badges (60%), loan stage tags, and status pills."
                        value={theme.activeBadgeBg || theme.primaryLightColor || "#eef7f2"}
                        onChange={(val) => {
                          setTheme((prev) => ({ ...prev, customBadgeBgExplicit: true }));
                          handleColorChange("activeBadgeBg", val);
                        }}
                      />

                      <ColorField
                        label="Badges &amp; Status Tags Text Color"
                        description="Text and border color inside commission tags, active stage pills, and status chips."
                        value={theme.activeBadgeText || theme.primaryColor || "#047857"}
                        onChange={(val) => {
                          setTheme((prev) => ({ ...prev, customBadgeTextExplicit: true }));
                          handleColorChange("activeBadgeText", val);
                        }}
                      />
                    </div>
                  </div>

                  {/* SECTION 3: SIDEBAR & NAVIGATION */}
                  <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ marginBottom: "14px", paddingBottom: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "12px", fontWeight: 750, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        3. Sidebar &amp; Navigation Menu
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: "14px" }}>
                      <ColorField
                        label="Sidebar Background Color"
                        description="Background color for the left navigation sidebar and mobile headers (Default: #101922)."
                        value={theme.sidebarBg || "#101922"}
                        onChange={(val) => {
                          handleColorChange("sidebarBg", val);
                          handleColorChange("headerBg", val);
                        }}
                      />

                      <ColorField
                        label="Sidebar Text &amp; Icons Color"
                        description="Typography color for menu links inside the sidebar (Default: #f8fafc)."
                        value={theme.sidebarText || "#f8fafc"}
                        onChange={(val) => handleColorChange("sidebarText", val)}
                      />

                      <ColorField
                        label="Sidebar Active Item Highlight"
                        description="Glow or accent background for the currently active/selected menu link."
                        value={theme.sidebarActiveBg || hexToRgba(theme.primaryColor || "#047857", 0.22)}
                        onChange={(val) => {
                          setTheme((prev) => ({ ...prev, customSidebarActiveExplicit: true }));
                          handleColorChange("sidebarActiveBg", val);
                        }}
                      />
                    </div>
                  </div>

                  {/* SECTION 4: PANEL CANVAS & TYPOGRAPHY */}
                  <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ marginBottom: "14px", paddingBottom: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "12px", fontWeight: 750, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        4. Panel Canvas &amp; Typography
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: "14px" }}>
                      <ColorField
                        label="Panel Main Background Color"
                        description="Overall background color for the CRM dashboard and page screens (Default: #fafbf9)."
                        value={theme.backgroundColor || "#fafbf9"}
                        onChange={(val) => handleColorChange("backgroundColor", val)}
                      />

                      <ColorField
                        label="Card &amp; Container Surface Color"
                        description="Background color for content cards, tables, and modal dialogs (Default: #ffffff)."
                        value={theme.surfaceColor || "#ffffff"}
                        onChange={(val) => handleColorChange("surfaceColor", val)}
                      />

                      <ColorField
                        label="Headings &amp; Main Text Color"
                        description="Color for page titles, labels, card headers, and body typography (Default: #111827)."
                        value={theme.textColor || "#111827"}
                        onChange={(val) => handleColorChange("textColor", val)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Mini-Dashboard Preview */}
          <div
            style={{
              padding: "20px",
              background: "#f1f5f9",
              borderLeft: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 750,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                }}
              >
                Real-Time Preview
              </span>
              <h4 style={{ margin: "2px 0 0", fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>
                Interactive Preview
              </h4>
            </div>

            {/* Mock Mini CRM Interface */}
            <div
              style={{
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid #cbd5e1",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
                height: "360px",
                background: theme.backgroundColor || "#fafbf9",
              }}
            >
              {/* Mini Header Bar */}
              <div
                style={{
                  height: "38px",
                  background: theme.headerBg || theme.sidebarBg || "#101922",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "4px",
                      background: theme.primaryColor || "#047857",
                    }}
                  />
                  <span style={{ fontSize: "11px", fontWeight: 700 }}>Company CRM</span>
                </div>
                <div
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: theme.primaryColor || "#047857",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#ffffff",
                  }}
                >
                  + Add Lead
                </div>
              </div>

              {/* Mini Body: Sidebar + Content */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Mini Sidebar */}
                <div
                  style={{
                    width: "80px",
                    background: theme.sidebarBg || "#101922",
                    padding: "10px 6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Active Nav Item */}
                  <div
                    style={{
                      padding: "5px 6px",
                      borderRadius: "4px",
                      background: theme.sidebarActiveBg || hexToRgba(theme.primaryColor || "#047857", 0.22),
                      borderLeft: `2.5px solid ${theme.primaryColor || "#047857"}`,
                      color: "#ffffff",
                      fontSize: "9.5px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <LayoutDashboard size={10} color={theme.primaryColor || "#047857"} />
                    <span>Leads</span>
                  </div>

                  {/* Regular Nav Item */}
                  <div
                    style={{
                      padding: "5px 6px",
                      borderRadius: "4px",
                      color: theme.sidebarText || "#f8fafc",
                      opacity: 0.75,
                      fontSize: "9.5px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Layers size={10} />
                    <span>Tasks</span>
                  </div>
                </div>

                {/* Mini Content Area */}
                <div
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: theme.backgroundColor || "#fafbf9",
                    color: theme.textColor || "#111827",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {/* Mini Card */}
                  <div
                    style={{
                      background: theme.surfaceColor || "#ffffff",
                      borderRadius: "8px",
                      padding: "10px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 750,
                          color: theme.textColor || "#111827",
                        }}
                      >
                        Sample Loan Case #4892
                      </span>
                      <span
                        style={{
                          fontSize: "8.5px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "999px",
                          background: theme.primaryLightColor || "#eef7f2",
                          color: theme.primaryColor || "#047857",
                        }}
                      >
                        Sanctioned
                      </span>
                    </div>
                    <p
                      style={{
                        margin: "0 0 10px",
                        fontSize: "9.5px",
                        color: theme.textMutedColor || "#64748b",
                        lineHeight: 1.3,
                      }}
                    >
                      Applicant: Rahul Sharma • Loan: ₹15,00,000 • Branch: Mumbai Central
                    </p>

                    {/* Interactive Button in Mini Preview */}
                    <button
                      type="button"
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "none",
                        background: theme.primaryColor || "#047857",
                        color: "#ffffff",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: `0 2px 8px ${hexToRgba(theme.primaryColor || "#047857", 0.25)}`,
                        transition: "background 0.15s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background =
                          theme.primaryHoverColor || generateHoverColor(theme.primaryColor || "#047857");
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = theme.primaryColor || "#047857";
                      }}
                    >
                      Process Lead Now
                    </button>
                  </div>

                  {/* Interactive Table Preview with Rows, Hover & Badges */}
                  <div
                    style={{
                      background: theme.surfaceColor || "#ffffff",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: theme.tableHeaderBg || "#f8fafc",
                        padding: "5px 8px",
                        borderBottom: "1px solid #e2e8f0",
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "8.5px",
                        fontWeight: 750,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: theme.textMutedColor || "#64748b",
                      }}
                    >
                      <span>Lead / Name</span>
                      <span>Commission</span>
                      <span>Stage</span>
                    </div>

                    {/* Table Row 1 (Normal) */}
                    <div
                      style={{
                        padding: "5px 8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "9px",
                        borderBottom: "1px solid #f1f5f9",
                        color: theme.textColor || "#0f172a",
                      }}
                    >
                      <span style={{ fontWeight: 650 }}>Rajesh Verma</span>
                      <span
                        style={{
                          padding: "1px 5px",
                          borderRadius: "4px",
                          fontSize: "8px",
                          fontWeight: 700,
                          background: theme.activeBadgeBg || theme.primaryLightColor || "#eef7f2",
                          color: theme.activeBadgeText || theme.primaryColor || "#047857",
                          border: `1px solid ${hexToRgba(theme.primaryColor || "#047857", 0.25)}`,
                        }}
                      >
                        60%
                      </span>
                      <span style={{ fontSize: "8px", fontWeight: 700, color: theme.primaryColor || "#047857" }}>
                        Disbursed
                      </span>
                    </div>

                    {/* Table Row 2 (Simulated Hover State) */}
                    <div
                      style={{
                        padding: "5px 8px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "9px",
                        background: theme.tableRowHoverBg || theme.primaryLightColor || "#eef7f2",
                        color: theme.textColor || "#0f172a",
                      }}
                    >
                      <span style={{ fontWeight: 650 }}>Priya Patel (Hover)</span>
                      <span
                        style={{
                          padding: "1px 5px",
                          borderRadius: "4px",
                          fontSize: "8px",
                          fontWeight: 700,
                          background: theme.activeBadgeBg || theme.primaryLightColor || "#eef7f2",
                          color: theme.activeBadgeText || theme.primaryColor || "#047857",
                          border: `1px solid ${hexToRgba(theme.primaryColor || "#047857", 0.25)}`,
                        }}
                      >
                        50%
                      </span>
                      <span style={{ fontSize: "8px", fontWeight: 700, color: theme.primaryColor || "#047857" }}>
                        Sanctioned
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Palette Chips */}
            <div
              style={{
                background: "#ffffff",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "8px" }}>
                Active Color Codes:
              </span>
              <div style={{ display: "grid", gap: "5px", fontSize: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Brand / Action:</span>
                  <code style={{ fontWeight: 700, color: theme.primaryColor }}>{theme.primaryColor}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Hover State:</span>
                  <code style={{ fontWeight: 700, color: theme.primaryHoverColor }}>{theme.primaryHoverColor}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Table Row Hover:</span>
                  <code style={{ fontWeight: 700, color: theme.tableRowHoverBg }}>{theme.tableRowHoverBg || theme.primaryLightColor}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Badges &amp; Tags:</span>
                  <code style={{ fontWeight: 700, color: theme.activeBadgeText || theme.primaryColor }}>{theme.activeBadgeBg || theme.primaryLightColor}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Background:</span>
                  <code style={{ fontWeight: 700 }}>{theme.backgroundColor}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Text Color:</span>
                  <code style={{ fontWeight: 700 }}>{theme.textColor}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Sidebar:</span>
                  <code style={{ fontWeight: 700 }}>{theme.sidebarBg}</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f8fafc",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={saving}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 650,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RotateCcw size={14} /> Reset to Default CRM Colors
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              style={{
                padding: "9px 18px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTheme}
              disabled={saving}
              style={{
                padding: "9px 22px",
                borderRadius: "8px",
                border: "none",
                background: theme.primaryColor || "#047857",
                color: "#ffffff",
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: `0 4px 14px ${hexToRgba(theme.primaryColor || "#047857", 0.35)}`,
                transition: "background 0.15s",
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" /> Saving Colors...
                </>
              ) : (
                <>
                  <Save size={15} /> Save & Apply Theme
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Color Picker + Hex Input Field Component
 */
function ColorField({ label, description, value, onChange }) {
  const [localHex, setLocalHex] = useState(value || "#000000");

  useEffect(() => {
    setLocalHex(value || "#000000");
  }, [value]);

  const handleTextChange = (e) => {
    let text = e.target.value.trim();
    if (!text.startsWith("#") && text.length > 0) {
      text = "#" + text;
    }
    setLocalHex(text);
    if (isValidHex(text)) {
      onChange(text);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "12px 14px",
        borderRadius: "10px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <label
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 700,
            color: "#1e293b",
            marginBottom: "2px",
          }}
        >
          {label}
        </label>
        {description && (
          <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b", lineHeight: 1.3 }}>
            {description}
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {/* Visual Native Color Picker Swatch */}
        <div
          style={{
            position: "relative",
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            border: "2px solid #cbd5e1",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            cursor: "pointer",
          }}
        >
          <input
            type="color"
            value={isValidHex(value) ? value : "#047857"}
            onChange={(e) => {
              setLocalHex(e.target.value);
              onChange(e.target.value);
            }}
            style={{
              position: "absolute",
              top: "-50%",
              left: "-50%",
              width: "200%",
              height: "200%",
              cursor: "pointer",
              border: "none",
              background: "transparent",
            }}
          />
        </div>

        {/* Manual Hex Code Text Input */}
        <input
          type="text"
          value={localHex}
          onChange={handleTextChange}
          placeholder="#047857"
          maxLength={7}
          style={{
            width: "88px",
            height: "36px",
            padding: "0 10px",
            borderRadius: "7px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            fontSize: "12.5px",
            fontFamily: "monospace",
            fontWeight: 700,
            color: "#0f172a",
            textAlign: "center",
          }}
        />
      </div>
    </div>
  );
}
