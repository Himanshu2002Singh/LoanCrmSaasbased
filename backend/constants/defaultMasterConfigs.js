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
  { configType: "LEAD_STATUS", label: "Sanctioned", value: "SANCTIONED", colorCode: "#10B981", orderIndex: 50, team: "operations" },
  { configType: "LEAD_STATUS", label: "Disbursed", value: "DISBURSED", colorCode: "#047857", orderIndex: 60, team: "operations" },
  { configType: "LEAD_STATUS", label: "Rejected", value: "REJECTED", colorCode: "#EF4444", orderIndex: 70, team: "both" },

  { configType: "LOAN_PRODUCT", label: "Home Loan", value: "HOME_LOAN", orderIndex: 10 },
  { configType: "LOAN_PRODUCT", label: "Personal Loan", value: "PERSONAL_LOAN", orderIndex: 20 },
  { configType: "LOAN_PRODUCT", label: "Business Loan", value: "BUSINESS_LOAN", orderIndex: 30 },
  { configType: "LOAN_PRODUCT", label: "Mortgage Loan (LAP)", value: "LAP", orderIndex: 40 },

  { configType: "DOC_TYPE", label: "PAN Card", value: "PAN", orderIndex: 10 },
  { configType: "DOC_TYPE", label: "Aadhaar Card", value: "AADHAAR", orderIndex: 20 },
  { configType: "DOC_TYPE", label: "Salary Slip (Last 3 Months)", value: "SALARY_SLIP", orderIndex: 30 },
  { configType: "DOC_TYPE", label: "Bank Statement (Last 6 Months)", value: "BANK_STATEMENT", orderIndex: 40 },
  { configType: "DOC_TYPE", label: "ITR / Form 16", value: "ITR", orderIndex: 50 },

  { configType: "LEAD_SOURCE", label: "Self / Direct Walkin", value: "Self", colorCode: "#10b981", code: "DIR-001", commissionPercent: 0.0, orderIndex: 10 },
  { configType: "LEAD_SOURCE", label: "DSA Direct Partner", value: "DSA Partner", colorCode: "#f59e0b", code: "PTY-001", commissionPercent: 1.50, orderIndex: 20 },
  { configType: "LEAD_SOURCE", label: "Sharma & Associates (DSA)", value: "Sharma DSA", colorCode: "#3b82f6", code: "PTY-002", commissionPercent: 1.25, orderIndex: 30 },
  { configType: "LEAD_SOURCE", label: "Pooja Financial Consultancy", value: "Pooja Finance", colorCode: "#8b5cf6", code: "PTY-003", commissionPercent: 1.20, orderIndex: 40 },
  { configType: "LEAD_SOURCE", label: "FinTech Connectors Network", value: "FinTech Connect", colorCode: "#ec4899", code: "PTY-004", commissionPercent: 1.40, orderIndex: 50 },
  { configType: "LEAD_SOURCE", label: "Bank Referral Channel", value: "Bank Referral", colorCode: "#06b6d4", code: "PTY-005", commissionPercent: 1.00, orderIndex: 60 },
  { configType: "LEAD_SOURCE", label: "Direct Inward Call", value: "Direct Call", colorCode: "#14b8a6", code: "PTY-006", commissionPercent: 0.0, orderIndex: 70 },
  { configType: "LEAD_SOURCE", label: "Website / Online Ads", value: "Online", colorCode: "#6366f1", code: "PTY-007", commissionPercent: 0.50, orderIndex: 80 },
];

module.exports = { DEFAULT_MASTER_CONFIGS };
