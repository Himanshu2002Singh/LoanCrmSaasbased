import React from "react";

/**
 * Seats used against the seat cap. A company at its ceiling cannot add another
 * user until it upgrades, so the bar turns red before support has to explain
 * why "add user" is failing.
 */
function SeatMeter({ used = 0, limit = null }) {
  if (limit === null || limit === undefined) {
    return (
      <div className="cc-pl-seats">
        <div>{used}</div>
        <div className="cc-pl-sub">no cap</div>
      </div>
    );
  }

  const pct = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;
  const tone = used >= limit ? "full" : pct >= 80 ? "near" : "";

  return (
    <div className="cc-pl-seats">
      <div>
        {used} / {limit}
      </div>
      <div className={`cc-pl-seat-bar ${tone}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default SeatMeter;
