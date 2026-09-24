/**
 * The master_configs rows every new company starts with.
 *
 * A company with no LEAD_STATUS rows cannot take a lead at all — status
 * resolution finds nothing to put the lead on — so provisioning has to seed
 * these, not just insert the company. The NEW and PASSED_TO_OPS values are
 * depended on by constants/leadWorkflow.js; renaming their labels is fine,
 * changing their values is not.
 *
 * An admin may edit, reorder or retire any of these afterwards.
 */
const DEFAULT_MASTER_CONFIGS = [
  { configType: "LEAD_STATUS", label: "New Lead", value: "NEW", colorCode: "#3B82F6", orderIndex: 10, team: "calling" },
  { configType: "LEAD_STATUS", label: "Follow Up", value: "FOLLOW_UP", colorCode: "#EAB308", orderIndex: 20, team: "calling" },
  { configType: "LEAD_STATUS", label: "Interested", value: "INTERESTED", colorCode: "#10B981", orderIndex: 30, team: "calling" },
  { configType: "LEAD_STATUS", label: "Passed to Ops", value: "PASSED_TO_OPS", colorCode: "#8B5CF6", orderIndex: 40, team: "both" },
  { configType: "LEAD_STATUS", label: "Rejected", value: "REJECTED", colorCode: "#EF4444", orderIndex: 50, team: "both" },

  { configType: "LOAN_PRODUCT", label: "Home Loan", value: "HOME_LOAN", orderIndex: 10 },
  { configType: "LOAN_PRODUCT", label: "Personal Loan", value: "PERSONAL_LOAN", orderIndex: 20 },
  { configType: "LOAN_PRODUCT", label: "Business Loan", value: "BUSINESS_LOAN", orderIndex: 30 },
  { configType: "LOAN_PRODUCT", label: "Mortgage Loan (LAP)", value: "LAP", orderIndex: 40 },

  { configType: "DOC_TYPE", label: "PAN Card", value: "PAN", orderIndex: 10 },
  { configType: "DOC_TYPE", label: "Aadhaar Card", value: "AADHAAR", orderIndex: 20 },
  { configType: "DOC_TYPE", label: "Salary Slip (Last 3 Months)", value: "SALARY_SLIP", orderIndex: 30 },
  { configType: "DOC_TYPE", label: "Bank Statement (Last 6 Months)", value: "BANK_STATEMENT", orderIndex: 40 },
  { configType: "DOC_TYPE", label: "ITR / Form 16", value: "ITR", orderIndex: 50 },

  { configType: "LEAD_SOURCE", label: "Self", value: "Self", colorCode: "#10b981", orderIndex: 10 },
  { configType: "LEAD_SOURCE", label: "Referral / Party", value: "Referral", colorCode: "#8b5cf6", orderIndex: 20 },
  { configType: "LEAD_SOURCE", label: "Direct Inward Call", value: "Direct Call", colorCode: "#3b82f6", orderIndex: 30 },
  { configType: "LEAD_SOURCE", label: "DSA / Channel Partner", value: "DSA Partner", colorCode: "#f59e0b", orderIndex: 40 },
  { configType: "LEAD_SOURCE", label: "Website / Online Ads", value: "Online", colorCode: "#06b6d4", orderIndex: 50 },
];

module.exports = { DEFAULT_MASTER_CONFIGS };
