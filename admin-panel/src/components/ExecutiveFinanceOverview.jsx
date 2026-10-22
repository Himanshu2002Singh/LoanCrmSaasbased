import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

// Currency formatter for Indian financial figures
const formatIndianCurrency = (val) => {
  const num = Number(val || 0);
  const isNeg = num < 0;
  const abs = Math.abs(num);

  if (abs >= 10000000) {
    return `${isNeg ? "-" : ""}₹${(abs / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `${isNeg ? "-" : ""}₹${(abs / 100000).toFixed(2)} L`;
  }
  return `${isNeg ? "-" : ""}₹${Math.round(abs).toLocaleString("en-IN")}`;
};

// Generates fallback month labels (past 4 months) if database has zero monthly records
const getRecentMonthFallbacks = () => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const list = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    list.push({
      month: mStr,
      label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      disbursedAmount: 0,
      casesCount: 0,
      bankCommissionReceived: 0,
      partyPaidAmount: 0,
      totalOutflow: 0,
      netProfit: 0,
    });
  }
  return list;
};

// Custom top label for Disbursal by Month bars
const renderDisbursalBarLabel = (props) => {
  const { x, y, width, value } = props;
  if (!value || value === "₹0") return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      fill="#0f172a"
      textAnchor="middle"
      fontSize={11.5}
      fontWeight={700}
      letterSpacing="-0.01em"
      style={{ pointerEvents: "none" }}
    >
      {value}
    </text>
  );
};

// Tooltip for Disbursal by Month
const DisbursalTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="cc-exec-tooltip">
        <div className="cc-exec-tooltip-title">{data.fullLabel || data.month} Disbursal</div>
        <div className="cc-exec-tooltip-row">
          <span className="dot blue" />
          <span>Volume:</span>
          <strong>{data.displayVal}</strong>
        </div>
        <div className="cc-exec-tooltip-row">
          <span className="dot slate" />
          <span>Cases:</span>
          <strong>{data.casesCount} cases</strong>
        </div>
      </div>
    );
  }
  return null;
};

// Tooltip for Cash in vs cash out
const CashFlowTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="cc-exec-tooltip">
        <div className="cc-exec-tooltip-title">{data.fullLabel || data.month} Cash Flow</div>
        <div className="cc-exec-tooltip-row">
          <span className="dot amber" />
          <span>Bank payouts in:</span>
          <strong style={{ color: "#b45309" }}>{data.bankInDisplay}</strong>
        </div>
        <div className="cc-exec-tooltip-row">
          <span className="dot blue" />
          <span>Connectors &amp; out:</span>
          <strong style={{ color: "#1d4ed8" }}>{data.outDisplay}</strong>
        </div>
        <div className="cc-exec-tooltip-divider" />
        <div className="cc-exec-tooltip-row">
          <span>Net Profit:</span>
          <strong style={{ color: data.netProfit >= 0 ? "#047857" : "#dc2626" }}>
            {data.netDisplay}
          </strong>
        </div>
      </div>
    );
  }
  return null;
};

export default function ExecutiveFinanceOverview({ payoutMetrics }) {
  // Chronological monthly data from live database records
  const rawMonths = useMemo(() => {
    const list = payoutMetrics?.monthlyPayouts || [];
    if (!list.length) {
      return getRecentMonthFallbacks();
    }
    // Sort chronologically (oldest to newest)
    return [...list].sort((a, b) => (a.month || "").localeCompare(b.month || ""));
  }, [payoutMetrics?.monthlyPayouts]);

  const hasLiveActivity = useMemo(() => {
    return (
      (payoutMetrics?.totalDisbursed && payoutMetrics.totalDisbursed > 0) ||
      rawMonths.some((m) => (m.disbursedAmount || 0) > 0 || (m.bankCommissionReceived || 0) > 0)
    );
  }, [payoutMetrics, rawMonths]);

  // Map to Disbursal chart dataset
  const disbursalData = useMemo(() => {
    return rawMonths.map((m) => {
      const amt = Number(m.disbursedAmount || 0);
      const crVal = amt / 10000000;
      const monthAbbr = m.label ? m.label.split(" ")[0] : (m.month || "").slice(5);

      return {
        month: monthAbbr,
        fullLabel: m.label || m.month,
        amountCr: crVal > 0 ? crVal : 0,
        displayVal: amt > 0 ? formatIndianCurrency(amt) : "₹0",
        casesCount: m.casesCount || 0,
      };
    });
  }, [rawMonths]);

  // Map to Cash in vs Cash out dataset
  const cashFlowData = useMemo(() => {
    return rawMonths.map((m) => {
      const bankIn = Number(m.bankCommissionReceived || 0);
      const out = Number(m.totalOutflow ?? m.partyPaidAmount ?? 0);
      const net = bankIn - out;

      const bankInL = bankIn / 100000;
      const outL = out / 100000;
      const monthAbbr = m.label ? m.label.split(" ")[0] : (m.month || "").slice(5);

      return {
        month: monthAbbr,
        fullLabel: m.label || m.month,
        bankIn: bankInL > 0 ? Number(bankInL.toFixed(2)) : 0,
        out: outL > 0 ? Number(outL.toFixed(2)) : 0,
        bankInDisplay: formatIndianCurrency(bankIn),
        outDisplay: formatIndianCurrency(out),
        netProfit: net,
        netDisplay: formatIndianCurrency(net),
      };
    });
  }, [rawMonths]);

  // Overall Total Disbursed Stats from live data
  const totalDisbursalStat = useMemo(() => {
    const totalAmt = Number(payoutMetrics?.totalDisbursed || 0);
    const totalCases = Number(payoutMetrics?.totalDisbursedCases || 0);
    if (totalAmt > 0) {
      return `${formatIndianCurrency(totalAmt)} across ${totalCases} cases`;
    }
    return `₹0 across ${totalCases} cases`;
  }, [payoutMetrics]);

  // Max heights for chart domains
  const maxDisbursalCr = useMemo(() => {
    const max = Math.max(...disbursalData.map((d) => d.amountCr), 1);
    return max * 1.25;
  }, [disbursalData]);

  const maxCashL = useMemo(() => {
    const max = Math.max(...cashFlowData.map((d) => Math.max(d.bankIn, d.out)), 1);
    return max * 1.25;
  }, [cashFlowData]);

  return (
    <div className="cc-exec-finance-wrap">
      <style>{execFinanceStyles}</style>

      <div className="cc-exec-finance-grid">
        {/* CARD 1: DISBURSAL BY MONTH */}
        <section className="cc-exec-card">
          <div className="cc-exec-card-head">
            <h3 className="cc-exec-title">Disbursal by month</h3>
            <span className="cc-exec-header-stat">{totalDisbursalStat}</span>
          </div>

          <div className="cc-exec-chart-container">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart
                data={disbursalData}
                margin={{ top: 26, right: 14, left: 14, bottom: 4 }}
                barSize={32}
              >
                <CartesianGrid
                  vertical={false}
                  horizontal={true}
                  stroke="#f1f5f9"
                  strokeDasharray="0 0"
                />
                <XAxis
                  dataKey="month"
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                  dy={4}
                />
                <YAxis hide={true} domain={[0, maxDisbursalCr]} />
                <Tooltip
                  cursor={{ fill: "rgba(37, 99, 235, 0.04)" }}
                  content={<DisbursalTooltip />}
                />
                <Bar
                  dataKey="amountCr"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={true}
                >
                  <LabelList
                    dataKey="displayVal"
                    content={renderDisbursalBarLabel}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="cc-exec-footer-note">
            {hasLiveActivity ? (
              <span>
                {disbursalData
                  .filter((d) => d.casesCount > 0)
                  .map((d) => `${d.month}: ${d.casesCount} cases`)
                  .join(" · ") || "All recorded cases logged and disbursed."}
              </span>
            ) : (
              <span>No loan disbursal records logged for this period. Cases will appear here as they are disbursed.</span>
            )}
          </div>
        </section>

        {/* CARD 2: CASH IN VS CASH OUT */}
        <section className="cc-exec-card">
          <div className="cc-exec-card-head-compact">
            <h3 className="cc-exec-title">Cash in vs cash out</h3>
          </div>

          <div className="cc-exec-legend">
            <div className="cc-exec-legend-item">
              <span className="cc-legend-box amber" />
              <span>Bank payouts in</span>
            </div>
            <div className="cc-exec-legend-item">
              <span className="cc-legend-box blue" />
              <span>Connectors, salary &amp; office out</span>
            </div>
          </div>

          <div className="cc-exec-chart-container">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart
                data={cashFlowData}
                margin={{ top: 12, right: 14, left: 14, bottom: 4 }}
                barGap={4}
              >
                <CartesianGrid
                  vertical={false}
                  horizontal={true}
                  stroke="#f1f5f9"
                  strokeDasharray="0 0"
                />
                <XAxis
                  dataKey="month"
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
                  dy={4}
                />
                <YAxis hide={true} domain={[0, maxCashL]} />
                <Tooltip
                  cursor={{ fill: "rgba(15, 23, 42, 0.03)" }}
                  content={<CashFlowTooltip />}
                />
                <Bar
                  dataKey="bankIn"
                  fill="#cca028"
                  radius={[4, 4, 0, 0]}
                  barSize={24}
                  isAnimationActive={true}
                />
                <Bar
                  dataKey="out"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  barSize={24}
                  isAnimationActive={true}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="cc-exec-footer-note net-profit-line">
            <span className="net-profit-prefix">Net profit: </span>
            {hasLiveActivity ? (
              cashFlowData.map((item, index) => {
                const isPos = item.netProfit >= 0;
                return (
                  <React.Fragment key={item.month + index}>
                    {index > 0 && <span className="net-dot"> · </span>}
                    <span className="net-month-name">{item.month} </span>
                    <strong className={isPos ? "net-pos" : "net-neg"}>
                      {item.netDisplay}
                    </strong>
                  </React.Fragment>
                );
              })
            ) : (
              <span style={{ color: "#94a3b8" }}>No financial transactions recorded for this period.</span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const execFinanceStyles = `
  .cc-exec-finance-wrap {
    margin-bottom: 16px;
    width: 100%;
  }

  .cc-exec-finance-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  @media (max-width: 992px) {
    .cc-exec-finance-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Clean white card matching dashboard panels (.cc-panel) */
  .cc-exec-card {
    background: #ffffff;
    border: 1px solid var(--cc-line, #e2e8f0);
    border-radius: 12px;
    padding: 20px 24px 18px 24px;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.035);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 345px;
  }

  .cc-exec-card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .cc-exec-card-head-compact {
    margin-bottom: 4px;
  }

  .cc-exec-title {
    margin: 0;
    font-family: 'Newsreader', 'Playfair Display', Georgia, Cambria, 'Times New Roman', serif;
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.015em;
    line-height: 1.2;
  }

  .cc-exec-header-stat {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13.5px;
    font-weight: 600;
    color: #64748b;
    letter-spacing: 0;
  }

  .cc-exec-legend {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 6px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .cc-exec-legend-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    font-weight: 600;
    color: #334155;
  }
  .cc-legend-box {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    display: inline-block;
  }
  .cc-legend-box.amber {
    background: #cca028;
  }
  .cc-legend-box.blue {
    background: #3b82f6;
  }

  .cc-exec-chart-container {
    width: 100%;
    margin: 4px 0 2px;
  }

  .cc-exec-footer-note {
    font-size: 12px;
    color: #64748b;
    line-height: 1.55;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .cc-exec-footer-note.net-profit-line {
    white-space: normal;
  }

  .net-profit-prefix {
    color: #64748b;
    font-weight: 600;
  }
  .net-month-name {
    color: #334155;
    font-weight: 600;
  }
  .net-pos {
    color: #047857;
    font-weight: 700;
  }
  .net-neg {
    color: #dc2626;
    font-weight: 700;
  }
  .net-dot {
    color: #cbd5e1;
    margin: 0 1px;
  }

  /* Crisp Light Tooltip */
  .cc-exec-tooltip {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 9px 13px;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
    color: #0f172a;
    font-size: 12px;
    min-width: 150px;
  }
  .cc-exec-tooltip-title {
    font-weight: 700;
    font-size: 12.5px;
    color: #0f172a;
    margin-bottom: 6px;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 4px;
  }
  .cc-exec-tooltip-row {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 4px;
    font-size: 11.5px;
    color: #475569;
  }
  .cc-exec-tooltip-row strong {
    margin-left: auto;
    font-size: 12px;
  }
  .cc-exec-tooltip-divider {
    height: 1px;
    background: #f1f5f9;
    margin: 6px 0 4px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot.blue { background: #3b82f6; }
  .dot.amber { background: #cca028; }
  .dot.slate { background: #94a3b8; }
`;
