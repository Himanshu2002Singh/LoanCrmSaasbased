const LENDER_TYPES = {
  BANK: "Bank",
  NBFC: "NBFC",
  HFC: "HFC",
  FINTECH: "Fintech",
};

const CONTACT_TYPES = {
  RM: "RM",
  CREDIT: "Credit",
  OPERATIONS: "Operations",
  ESCALATION: "Escalation",
};

const LENDER_TYPE_VALUES = Object.values(LENDER_TYPES);
const CONTACT_TYPE_VALUES = Object.values(CONTACT_TYPES);

module.exports = {
  LENDER_TYPES,
  CONTACT_TYPES,
  LENDER_TYPE_VALUES,
  CONTACT_TYPE_VALUES,
};
