import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Shared pagination bar used by every redesigned list page so the pattern
// («  Prev  [n / M]  Next  ») and the "Showing page N of M · X total" label
// look identical everywhere.
export default function CcPagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  itemLabel = "items",
  className = "",
}) {
  if (!totalPages || totalPages < 1) return null;

  const goto = (nextPage) => {
    const clamped = Math.min(Math.max(nextPage, 1), totalPages);
    if (clamped !== currentPage) onPageChange(clamped);
  };

  const cls = ["cc-pagination", className].filter(Boolean).join(" ");

  return (
    <div className={cls}>
      <style>{styles}</style>
      <span className="cc-pagination-label">
        Showing page <b>{currentPage}</b> of <b>{totalPages}</b>
        {typeof totalItems === "number" ? (
          <span className="cc-pagination-total">
            {" "}&middot; {new Intl.NumberFormat("en-IN").format(totalItems)} {itemLabel}
          </span>
        ) : null}
      </span>
      <div className="cc-pagination-actions">
        <button
          type="button"
          className="cc-pagination-btn"
          disabled={currentPage === 1}
          onClick={() => goto(1)}
          title="First page"
        >
          &laquo;
        </button>
        <button
          type="button"
          className="cc-pagination-btn"
          disabled={currentPage === 1}
          onClick={() => goto(currentPage - 1)}
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <span className="cc-pagination-jump">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) goto(next);
            }}
          />
          / {totalPages}
        </span>
        <button
          type="button"
          className="cc-pagination-btn"
          disabled={currentPage >= totalPages}
          onClick={() => goto(currentPage + 1)}
        >
          Next <ChevronRight size={14} />
        </button>
        <button
          type="button"
          className="cc-pagination-btn"
          disabled={currentPage >= totalPages}
          onClick={() => goto(totalPages)}
          title="Last page"
        >
          &raquo;
        </button>
      </div>
    </div>
  );
}

const styles = `
  .cc-pagination { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:14px 4px 4px; border-top:1px solid #eef1ee; margin-top:10px; }
  .cc-pagination-label { font-size:13px; color:#475569; }
  .cc-pagination-label b { color:#0f172a; font-weight:600; }
  .cc-pagination-total { color:#94a3b8; }
  .cc-pagination-actions { display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .cc-pagination-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; font-size:13px; font-weight:600; color:#0f172a; background:#fff; border:1px solid #cbd5e1 !important; border-radius:10px !important; cursor:pointer; line-height:1; }
  .cc-pagination-btn:not(:disabled):hover { border-color:#047857 !important; color:#047857; }
  .cc-pagination-btn:disabled { opacity:0.48; cursor:not-allowed; }
  .cc-pagination-jump { display:inline-flex; align-items:center; gap:6px; margin:0 4px; font-size:13px; color:#475569; }
  .cc-pagination-jump input { width:56px; padding:6px 8px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; text-align:center; color:#0f172a; background:#fff; font-variant-numeric:tabular-nums; }
  .cc-pagination-jump input:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }
`;
