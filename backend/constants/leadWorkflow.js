/**
 * Lead status semantics.
 *
 * Statuses themselves are data: they live in master_configs rows of type
 * LEAD_STATUS and an admin may add, rename, reorder or retire them. What the
 * table does not carry is which side of the business owns a status, which one
 * a new lead starts on, and which one hands the file to operations. Those are
 * behaviour, not data, so they are declared here and keyed on the stable
 * master_configs.value.
 *
 * A status that is not listed is treated as visible to both teams: a custom
 * status an admin invents should not silently become unusable.
 */
const TEAMS = {
  CALLING: "calling",
  OPERATIONS: "operations",
  BOTH: "both",
};

const STATUS_TEAMS = {
  // Sales / Calling team
  NEW: TEAMS.CALLING,
  FOLLOW_UP: TEAMS.CALLING,
  INTERESTED: TEAMS.CALLING,
  NOT_INTERESTED: TEAMS.CALLING,
  CALL_BACK: TEAMS.CALLING,
  NOT_CONNECTED: TEAMS.CALLING,
  NOT_PICKED: TEAMS.CALLING,

  // Operations team
  DOCS_PENDING: TEAMS.OPERATIONS,
  DOCS_RECEIVED: TEAMS.OPERATIONS,
  VERIFICATION_PENDING: TEAMS.OPERATIONS,
  APPLICATION_CREATED: TEAMS.OPERATIONS,
  FILE_LOGIN: TEAMS.OPERATIONS,
  SANCTIONED: TEAMS.OPERATIONS,
  DISBURSED: TEAMS.OPERATIONS,

  // Shared / Handoff / Final
  PASSED_TO_OPS: TEAMS.BOTH,
  REJECTED: TEAMS.BOTH,
};

// The status a lead is created on when the caller does not name one. Falls
// back to the lowest order_index if this value is not configured.
const INITIAL_STATUS_VALUE = "NEW";

// Moving a lead onto this status is the sales-to-operations handoff.
const OPS_HANDOFF_STATUS_VALUE = "PASSED_TO_OPS";

// Statuses the workflow itself depends on. An admin may rename or recolour
// them, but deleting one would break the transitions above.
const PROTECTED_STATUS_VALUES = [INITIAL_STATUS_VALUE, OPS_HANDOFF_STATUS_VALUE];

const teamForStatus = (value, customTeam = null) => {
  if (customTeam && [TEAMS.CALLING, TEAMS.OPERATIONS, TEAMS.BOTH].includes(customTeam)) {
    return customTeam;
  }
  return STATUS_TEAMS[value] || TEAMS.CALLING;
};

const isProtectedStatus = (value) => PROTECTED_STATUS_VALUES.includes(value);

/**
 * Which configured status a new lead starts on. Prefers the declared initial
 * value; if an admin has retired it, the first status in display order stands
 * in, so lead creation never dead-ends.
 */
const resolveInitialStatus = (statusRows = []) =>
  statusRows.find((row) => row.value === INITIAL_STATUS_VALUE && row.isActive) ||
  statusRows.find((row) => row.isActive) ||
  statusRows[0] ||
  null;

module.exports = {
  TEAMS,
  STATUS_TEAMS,
  INITIAL_STATUS_VALUE,
  OPS_HANDOFF_STATUS_VALUE,
  PROTECTED_STATUS_VALUES,
  teamForStatus,
  isProtectedStatus,
  resolveInitialStatus,
};
