const bcrypt = require("bcrypt");
const db = require("./models");
const { ROLES } = require("./constants/roles");

const SALT_ROUNDS = 10;

// Helper to get random item
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Helper for random number between min and max
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
// Helper for date in past N days
const daysAgo = (days, hour = 11, minute = 30) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, randInt(0, 59), 0);
  return d;
};
// Helper for date string YYYY-MM-DD
const dateStr = (dateObj) => dateObj.toISOString().split("T")[0];

async function runMarketingSeeder() {
  try {
    console.log("=================================================");
    console.log("  STARTING PHOTOGRAPHY-GRADE CRM DATA SEEDER   ");
    console.log("=================================================\n");

    await db.sequelize.authenticate();
    console.log("✓ Database connection established.");

    const defaultPasswordHash = await bcrypt.hash("Admin@123456", SALT_ROUNDS);

    // Get all companies
    const companies = await db.Company.findAll();
    if (!companies || companies.length === 0) {
      console.log("No company found. Please run syncDb.js first.");
      process.exit(1);
    }

    for (const company of companies) {
      console.log(`\n-------------------------------------------------`);
      console.log(`Seeding Demo Data for Company: [ID ${company.id}] ${company.name} (${company.slug})`);
      console.log(`-------------------------------------------------`);

      const companyId = company.id;

      // 1. MASTER CONFIGS
      console.log("1. Seeding Master Configurations...");
      const masterConfigsList = [
        // Lead Statuses
        { configType: "LEAD_STATUS", label: "Fresh Lead", value: "NEW", colorCode: "#3B82F6", orderIndex: 10 },
        { configType: "LEAD_STATUS", label: "Interested", value: "INTERESTED", colorCode: "#10B981", orderIndex: 20 },
        { configType: "LEAD_STATUS", label: "Follow Up", value: "FOLLOW_UP", colorCode: "#F59E0B", orderIndex: 30 },
        { configType: "LEAD_STATUS", label: "Call Back", value: "CALL_BACK", colorCode: "#8B5CF6", orderIndex: 40 },
        { configType: "LEAD_STATUS", label: "Document Pending", value: "DOCS_PENDING", colorCode: "#EC4899", orderIndex: 50 },
        { configType: "LEAD_STATUS", label: "File Login", value: "FILE_LOGIN", colorCode: "#0EA5E9", orderIndex: 60 },
        { configType: "LEAD_STATUS", label: "Passed to Ops", value: "PASSED_TO_OPS", colorCode: "#6366F1", orderIndex: 70 },
        { configType: "LEAD_STATUS", label: "Loan Section", value: "SANCTIONED", colorCode: "#14B8A6", orderIndex: 80 },
        { configType: "LEAD_STATUS", label: "Loan Disbursement", value: "DISBURSED", colorCode: "#059669", orderIndex: 90 },
        { configType: "LEAD_STATUS", label: "Rejected", value: "REJECTED", colorCode: "#EF4444", orderIndex: 100 },
        { configType: "LEAD_STATUS", label: "Not Connected", value: "NOT_CONNECTED", colorCode: "#94A3B8", orderIndex: 110 },
        { configType: "LEAD_STATUS", label: "Call Not Pick", value: "NOT_PICKED", colorCode: "#CBD5E1", orderIndex: 120 },

        // Loan Products
        { configType: "LOAN_PRODUCT", label: "Home Loan", value: "Home Loan", orderIndex: 10 },
        { configType: "LOAN_PRODUCT", label: "Business Loan", value: "Business Loan", orderIndex: 20 },
        { configType: "LOAN_PRODUCT", label: "Personal Loan", value: "Personal Loan", orderIndex: 30 },
        { configType: "LOAN_PRODUCT", label: "Mortgage Loan", value: "Mortgage Loan", orderIndex: 40 },
        { configType: "LOAN_PRODUCT", label: "User Car Loan", value: "User Car Loan", orderIndex: 50 },
        { configType: "LOAN_PRODUCT", label: "CC/OD", value: "CC/OD", orderIndex: 60 },
        { configType: "LOAN_PRODUCT", label: "CGTMSME", value: "CGTMSME", orderIndex: 70 },
        { configType: "LOAN_PRODUCT", label: "Mutual Fund", value: "Mutual Fund", orderIndex: 80 },
        { configType: "LOAN_PRODUCT", label: "Insurance", value: "Insurance", orderIndex: 90 },

        // Lead Sources / Connectors with party codes and commission percentages
        { configType: "LEAD_SOURCE", label: "Self / Direct Walkin", value: "Direct Walkin", code: "DIR-001", commissionPercent: 0.0, colorCode: "#10B981", orderIndex: 10 },
        { configType: "LEAD_SOURCE", label: "DSA Direct Partner", value: "DSA Partner", code: "PTY-001", commissionPercent: 1.50, colorCode: "#F59E0B", orderIndex: 20 },
        { configType: "LEAD_SOURCE", label: "Sharma & Associates (DSA)", value: "Sharma DSA", code: "PTY-002", commissionPercent: 1.25, colorCode: "#3B82F6", orderIndex: 30 },
        { configType: "LEAD_SOURCE", label: "Pooja Financial Consultancy", value: "Pooja Finance", code: "PTY-003", commissionPercent: 1.20, colorCode: "#8B5CF6", orderIndex: 40 },
        { configType: "LEAD_SOURCE", label: "FinTech Connectors Network", value: "FinTech Connect", code: "PTY-004", commissionPercent: 1.40, colorCode: "#EC4899", orderIndex: 50 },
        { configType: "LEAD_SOURCE", label: "Bank Referral Channel", value: "Bank Referral", code: "PTY-005", commissionPercent: 1.00, colorCode: "#06B6D4", orderIndex: 60 },
        { configType: "LEAD_SOURCE", label: "QuickLoan Associates", value: "QuickLoan DSA", code: "PTY-006", commissionPercent: 1.10, colorCode: "#14B8A6", orderIndex: 70 },
        { configType: "LEAD_SOURCE", label: "Google Ads Online", value: "Google Ads", code: "PTY-007", commissionPercent: 0.80, colorCode: "#6366F1", orderIndex: 80 },
        { configType: "LEAD_SOURCE", label: "Facebook / Instagram Ads", value: "Facebook Ads", code: "PTY-008", commissionPercent: 0.80, colorCode: "#A855F7", orderIndex: 90 },
        { configType: "LEAD_SOURCE", label: "Website Referral Portal", value: "Website", code: "PTY-009", commissionPercent: 0.50, colorCode: "#0EA5E9", orderIndex: 100 },

        // Doc Types
        { configType: "DOC_TYPE", label: "PAN Card", value: "PAN", orderIndex: 10 },
        { configType: "DOC_TYPE", label: "Aadhaar Card", value: "AADHAAR", orderIndex: 20 },
        { configType: "DOC_TYPE", label: "Salary Slip (Last 3 Months)", value: "SALARY_SLIP", orderIndex: 30 },
        { configType: "DOC_TYPE", label: "Bank Statement (Last 6 Months)", value: "BANK_STATEMENT", orderIndex: 40 },
        { configType: "DOC_TYPE", label: "ITR / Form 16 (2 Years)", value: "ITR", orderIndex: 50 },
        { configType: "DOC_TYPE", label: "Property Title Deeds", value: "PROPERTY_CHAIN", orderIndex: 60 },
        { configType: "DOC_TYPE", label: "GST Certificate & Returns", value: "GST_RETURNS", orderIndex: 70 },
      ];

      for (const item of masterConfigsList) {
        const [cfg, created] = await db.MasterConfig.findOrCreate({
          where: { companyId, configType: item.configType, value: item.value },
          defaults: { companyId, ...item },
        });
        if (!created) {
          await cfg.update({
            label: item.label,
            colorCode: item.colorCode || cfg.colorCode,
            orderIndex: item.orderIndex || cfg.orderIndex,
            code: item.code !== undefined ? item.code : cfg.code,
            commissionPercent: item.commissionPercent !== undefined ? item.commissionPercent : cfg.commissionPercent,
            isActive: true,
          });
        }
      }

      // 2. BRANCHES
      console.log("2. Seeding Corporate Branches...");
      const branchData = [
        {
          name: "Headquarters - Jaipur (Tonk Road)",
          city: "Jaipur",
          state: "Rajasthan",
          address: "Apex Tower, 4th Floor, Tonk Road, Jaipur",
          officeLat: 26.8912,
          officeLng: 75.8054,
          geoRadiusMeters: 350,
          workStartTime: "09:30",
          workEndTime: "18:30",
          lateBufferMinutes: 15,
          halfDayHours: 4.5,
        },
        {
          name: "Delhi NCR Hub - Connaught Place",
          city: "New Delhi",
          state: "Delhi",
          address: "Statesman House, Barakhamba Road, Connaught Place",
          officeLat: 28.6315,
          officeLng: 77.2167,
          geoRadiusMeters: 300,
          workStartTime: "09:00",
          workEndTime: "18:00",
          lateBufferMinutes: 10,
          halfDayHours: 4.0,
        },
        {
          name: "Mumbai Regional Office - BKC",
          city: "Mumbai",
          state: "Maharashtra",
          address: "Capital Square, G Block, Bandra Kurla Complex (BKC)",
          officeLat: 19.0657,
          officeLng: 72.8685,
          geoRadiusMeters: 250,
          workStartTime: "10:00",
          workEndTime: "19:00",
          lateBufferMinutes: 20,
          halfDayHours: 4.5,
        },
        {
          name: "Bengaluru Tech Park Branch",
          city: "Bengaluru",
          state: "Karnataka",
          address: "Indiranagar 100ft Road, Stage 2, Bengaluru",
          officeLat: 12.9784,
          officeLng: 77.6408,
          geoRadiusMeters: 300,
          workStartTime: "09:30",
          workEndTime: "18:30",
          lateBufferMinutes: 15,
          halfDayHours: 4.0,
        },
        {
          name: "Pune Commercial Branch",
          city: "Pune",
          state: "Maharashtra",
          address: "ICC Trade Tower, Senapati Bapat Road, Shivaji Nagar",
          officeLat: 18.5314,
          officeLng: 73.8446,
          geoRadiusMeters: 250,
          workStartTime: null, // Fallback to global company timings (10:00 - 19:00, 10m buffer)
          workEndTime: null,
          lateBufferMinutes: null,
          halfDayHours: null,
        },
      ];

      const branches = [];
      for (const b of branchData) {
        let [branch, created] = await db.Branch.findOrCreate({
          where: { companyId, name: b.name },
          defaults: { companyId, ...b },
        });
        if (!created) {
          await branch.update(b);
        }
        branches.push(branch);
      }
      const defaultBranch = branches[0];

      // 3. USERS / STAFF
      console.log("3. Seeding Team Members & Organization Hierarchy...");
      const staffProfiles = [
        {
          name: "Priyanshu Mathur",
          email: companyId === 1 ? "priyanshu@capitalcare.com" : "priyanshu@gmail.com",
          phone: "9829011223",
          role: ROLES.MANAGER,
          branchId: branches[0].id,
          managerKey: null,
        },
        {
          name: "Rahul Sharma",
          email: `rahul.sharma@c${companyId}.capitalcare.com`,
          phone: "9829022334",
          role: ROLES.MANAGER,
          branchId: branches[1].id,
          managerKey: null,
        },
        {
          name: "Vikram Malhotra",
          email: `vikram.m@c${companyId}.capitalcare.com`,
          phone: "9829033445",
          role: ROLES.EMPLOYEE,
          branchId: branches[0].id,
          managerKey: "Priyanshu Mathur",
        },
        {
          name: "Sneha Patel",
          email: `sneha.patel@c${companyId}.capitalcare.com`,
          phone: "9829044556",
          role: ROLES.EMPLOYEE,
          branchId: branches[2].id,
          managerKey: "Priyanshu Mathur",
        },
        {
          name: "Amit Verma",
          email: `amit.verma@c${companyId}.capitalcare.com`,
          phone: "9829055667",
          role: ROLES.EMPLOYEE,
          branchId: branches[0].id,
          managerKey: "Priyanshu Mathur",
        },
        {
          name: "Neha Gupta",
          email: `neha.gupta@c${companyId}.capitalcare.com`,
          phone: "9829066778",
          role: ROLES.EMPLOYEE,
          branchId: branches[1].id,
          managerKey: "Rahul Sharma",
        },
        {
          name: "Rohit Singhania",
          email: `rohit.s@c${companyId}.capitalcare.com`,
          phone: "9829077889",
          role: ROLES.EMPLOYEE,
          branchId: branches[3].id,
          managerKey: "Rahul Sharma",
        },
        {
          name: "Ananya Joshi",
          email: `ananya.j@c${companyId}.capitalcare.com`,
          phone: "9829088990",
          role: ROLES.EMPLOYEE,
          branchId: branches[4].id,
          managerKey: "Rahul Sharma",
        },
        {
          name: "Rajesh Kumar (Ops Head)",
          email: `rajesh.ops@c${companyId}.capitalcare.com`,
          phone: "9829099001",
          role: ROLES.OPS,
          branchId: branches[0].id,
          managerKey: null,
        },
        {
          name: "Kavita Sen (Credit Ops)",
          email: `kavita.ops@c${companyId}.capitalcare.com`,
          phone: "9829100112",
          role: ROLES.OPS,
          branchId: branches[1].id,
          managerKey: null,
        },
        {
          name: "Alok Agarwal (HDFC Bank)",
          email: `alok.hdfc@c${companyId}.capitalcare.com`,
          phone: "9829111223",
          role: ROLES.BANKER,
          branchId: branches[0].id,
          managerKey: null,
        },
        {
          name: "Sanjay Mehta (ICICI Bank)",
          email: `sanjay.icici@c${companyId}.capitalcare.com`,
          phone: "9829122334",
          role: ROLES.BANKER,
          branchId: branches[2].id,
          managerKey: null,
        },
      ];

      const activeUsers = [];
      for (const sp of staffProfiles) {
        let user = await db.User.findOne({ where: { companyId, email: sp.email } });
        if (!user) {
          user = await db.User.create({
            companyId,
            name: sp.name,
            email: sp.email,
            phone: sp.phone,
            password: defaultPasswordHash,
            role: sp.role,
            branchId: sp.branchId,
            status: "active",
          });
        } else {
          await user.update({
            name: sp.name,
            branchId: sp.branchId,
            role: sp.role,
            status: "active",
          });
        }
        activeUsers.push(user);
      }

      // Link employees to their designated managers
      const mgrPriyanshu = activeUsers.find(
        (u) => u.role === ROLES.MANAGER && (u.email.includes("priyanshu") || u.name.includes("Priyanshu"))
      );
      const mgrRahul = activeUsers.find(
        (u) => u.role === ROLES.MANAGER && (u.email.includes("rahul") || u.name.includes("Rahul"))
      );

      for (const sp of staffProfiles) {
        const emp = activeUsers.find((u) => u.email === sp.email);
        if (!emp) continue;

        let targetMgrId = null;
        if (sp.managerKey === "Priyanshu Mathur" && mgrPriyanshu) {
          targetMgrId = mgrPriyanshu.id;
        } else if (sp.managerKey === "Rahul Sharma" && mgrRahul) {
          targetMgrId = mgrRahul.id;
        }

        await emp.update({ managerId: targetMgrId });
        emp.managerId = targetMgrId;
      }

      // Also get any existing admin user
      const companyAdmin = await db.User.findOne({
        where: { companyId, role: ROLES.COMPANY_ADMIN },
      });
      if (companyAdmin) {
        await companyAdmin.update({ branchId: defaultBranch.id });
      }

      const salesUsers = activeUsers.filter(
        (u) => u.role === ROLES.EMPLOYEE || u.role === ROLES.MANAGER
      );
      const opsUsers = activeUsers.filter((u) => u.role === ROLES.OPS);
      const bankerUsers = activeUsers.filter((u) => u.role === ROLES.BANKER);

      // 4. LENDERS & NBFC PARTNERS
      console.log("4. Seeding Bank & NBFC Partners...");
      const lendersData = [
        { name: "HDFC Bank Ltd.", shortCode: "HDFC", lenderType: "Bank", contactPerson: "Alok Agarwal (Credit Manager)", payoutCommissionPercent: 1.25 },
        { name: "ICICI Bank Ltd.", shortCode: "ICICI", lenderType: "Bank", contactPerson: "Sanjay Mehta (AVP Loans)", payoutCommissionPercent: 1.15 },
        { name: "State Bank of India", shortCode: "SBI", lenderType: "Bank", contactPerson: "Ritu Saxena (Chief Manager)", payoutCommissionPercent: 0.90 },
        { name: "Axis Bank Ltd.", shortCode: "AXIS", lenderType: "Bank", contactPerson: "Manish Tiwari (Branch Head)", payoutCommissionPercent: 1.20 },
        { name: "Kotak Mahindra Bank", shortCode: "KOTAK", lenderType: "Bank", contactPerson: "Deepak Chawla", payoutCommissionPercent: 1.30 },
        { name: "Bajaj Finserv Ltd.", shortCode: "BAJAJ", lenderType: "NBFC", contactPerson: "Harish Sharma (Sales Head)", payoutCommissionPercent: 1.60 },
        { name: "Tata Capital Financial", shortCode: "TATACAP", lenderType: "NBFC", contactPerson: "Nikhil Deshmukh", payoutCommissionPercent: 1.50 },
        { name: "Aditya Birla Capital", shortCode: "ABC", lenderType: "NBFC", contactPerson: "Pooja Hegde", payoutCommissionPercent: 1.45 },
        { name: "Piramal Capital & Housing", shortCode: "PIRAMAL", lenderType: "NBFC", contactPerson: "Gaurav Singhal", payoutCommissionPercent: 1.75 },
        { name: "Poonawalla Fincorp", shortCode: "POONA", lenderType: "NBFC", contactPerson: "Sunil Shinde", payoutCommissionPercent: 1.80 },
      ];

      const lenders = [];
      for (const ld of lendersData) {
        let [lender] = await db.Lender.findOrCreate({
          where: { companyId, shortCode: ld.shortCode },
          defaults: { companyId, ...ld },
        });
        lenders.push(lender);
      }

      // 5. CUSTOMERS & LEADS
      console.log("5. Seeding High-Quality Lead Portfolio (60+ Leads)...");

      const customersData = [
        { name: "Dr. Arvind Singhal", mobile: `98201${companyId}0001`, email: `arvind.singhal${companyId}@apollo.org`, city: "Jaipur", employmentType: "Professional Doctor", monthlyIncome: 350000.0, panNumber: "ARVPS1101A", aadhaarMasked: "XXXX-XXXX-4512" },
        { name: "Meenakshi Kulkarni", mobile: `98201${companyId}0002`, email: `meenakshi.k${companyId}@tcs.com`, city: "Mumbai", employmentType: "Salaried (IT Tech Lead)", monthlyIncome: 185000.0, panNumber: "MEEPK2202B", aadhaarMasked: "XXXX-XXXX-9831" },
        { name: "Rajendra Prasad Goyal", mobile: `98201${companyId}0003`, email: `rpgoyal${companyId}@goyaltextiles.in`, city: "Jaipur", employmentType: "Self-Employed Business", monthlyIncome: 450000.0, panNumber: "RAJPG3303C", aadhaarMasked: "XXXX-XXXX-1123" },
        { name: "Sunita Deshmukh", mobile: `98201${companyId}0004`, email: `sunita.desh${companyId}@infosys.com`, city: "Pune", employmentType: "Salaried (VP Engineering)", monthlyIncome: 280000.0, panNumber: "SUNDD4404D", aadhaarMasked: "XXXX-XXXX-7654" },
        { name: "Kunal Bansal", mobile: `98201${companyId}0005`, email: `kunal.b${companyId}@bansalinfra.com`, city: "New Delhi", employmentType: "Self-Employed Business", monthlyIncome: 520000.0, panNumber: "KUNBB5505E", aadhaarMasked: "XXXX-XXXX-3344" },
        { name: "Pooja Kashyap", mobile: `98201${companyId}0006`, email: `pooja.kashyap${companyId}@hcl.com`, city: "Noida", employmentType: "Salaried (Sr. Manager)", monthlyIncome: 140000.0, panNumber: "POOPK6606F", aadhaarMasked: "XXXX-XXXX-5566" },
        { name: "Suresh Chandra Jain", mobile: `98201${companyId}0007`, email: `jainjewellers${companyId}@gmail.com`, city: "Jaipur", employmentType: "Self-Employed Business", monthlyIncome: 650000.0, panNumber: "SURCJ7707G", aadhaarMasked: "XXXX-XXXX-7788" },
        { name: "Deepak Shenoy", mobile: `98201${companyId}0008`, email: `deepak.shenoy${companyId}@wipro.com`, city: "Bengaluru", employmentType: "Salaried (Architect)", monthlyIncome: 225000.0, panNumber: "DEEPS8808H", aadhaarMasked: "XXXX-XXXX-9900" },
        { name: "Anjali Mukhopadhyay", mobile: `98201${companyId}0009`, email: `anjali.m${companyId}@pwc.com`, city: "Kolkata", employmentType: "Salaried (Chartered Accountant)", monthlyIncome: 195000.0, panNumber: "ANJAM9909I", aadhaarMasked: "XXXX-XXXX-1234" },
        { name: "Gaurav Narang", mobile: `98201${companyId}0010`, email: `gaurav${companyId}@naranglogistics.com`, city: "Gurugram", employmentType: "Self-Employed Business", monthlyIncome: 380000.0, panNumber: "GAUGN1010J", aadhaarMasked: "XXXX-XXXX-5678" },
        { name: "Tanya Aggarwal", mobile: `98201${companyId}0011`, email: `tanya.a${companyId}@adobe.com`, city: "Bengaluru", employmentType: "Salaried (UX Director)", monthlyIncome: 310000.0, panNumber: "TANAA1111K", aadhaarMasked: "XXXX-XXXX-9012" },
        { name: "Manish Bhardwaj", mobile: `98201${companyId}0012`, email: `manish.bhardwaj${companyId}@reliance.com`, city: "Mumbai", employmentType: "Salaried (General Manager)", monthlyIncome: 260000.0, panNumber: "MANMB2222L", aadhaarMasked: "XXXX-XXXX-3456" },
        { name: "Virendra Singh Rathore", mobile: `98201${companyId}0013`, email: `rathore.resorts${companyId}@gmail.com`, city: "Udaipur", employmentType: "Self-Employed Hotelier", monthlyIncome: 420000.0, panNumber: "VIRVR3333M", aadhaarMasked: "XXXX-XXXX-7890" },
        { name: "Shalini Nambiar", mobile: `98201${companyId}0014`, email: `shalini.n${companyId}@deloitte.com`, city: "Hyderabad", employmentType: "Salaried (Director Audit)", monthlyIncome: 290000.0, panNumber: "SHASN4444N", aadhaarMasked: "XXXX-XXXX-2345" },
        { name: "Harpreet Singh Sodhi", mobile: `98201${companyId}0015`, email: `harpreet${companyId}@sodhitrans.in`, city: "Chandigarh", employmentType: "Self-Employed Fleet Owner", monthlyIncome: 480000.0, panNumber: "HARHS5555O", aadhaarMasked: "XXXX-XXXX-6789" },
        { name: "Preeti Chhabra", mobile: `98201${companyId}0016`, email: `preeti.c${companyId}@accenture.com`, city: "Pune", employmentType: "Salaried (Lead Consultant)", monthlyIncome: 165000.0, panNumber: "PREPC6666P", aadhaarMasked: "XXXX-XXXX-0123" },
        { name: "Alok Nanda", mobile: `98201${companyId}0017`, email: `alok${companyId}@nandapharma.com`, city: "Ahmedabad", employmentType: "Self-Employed Pharma Distributor", monthlyIncome: 550000.0, panNumber: "ALONN7777Q", aadhaarMasked: "XXXX-XXXX-4567" },
        { name: "Bhavna Patel", mobile: `98201${companyId}0018`, email: `bhavna.patel${companyId}@kotak.com`, city: "Surat", employmentType: "Salaried (Wealth Manager)", monthlyIncome: 175000.0, panNumber: "BHABP8888R", aadhaarMasked: "XXXX-XXXX-8901" },
        { name: "Kamlesh Purohit", mobile: `98201${companyId}0019`, email: `kamlesh.marble${companyId}@gmail.com`, city: "Jaipur", employmentType: "Self-Employed Marble Exporter", monthlyIncome: 720000.0, panNumber: "KAMPP9999S", aadhaarMasked: "XXXX-XXXX-2346" },
        { name: "Divya Krishnan", mobile: `98201${companyId}0020`, email: `divya.k${companyId}@google.com`, city: "Bengaluru", employmentType: "Salaried (Product Manager)", monthlyIncome: 390000.0, panNumber: "DIVDK1020T", aadhaarMasked: "XXXX-XXXX-6780" },
        { name: "Ashok Mittal", mobile: `98201${companyId}0021`, email: `mittal.ashok${companyId}@mittalsteel.com`, city: "New Delhi", employmentType: "Self-Employed Manufacturing", monthlyIncome: 850000.0, panNumber: "ASHAM1121U", aadhaarMasked: "XXXX-XXXX-1357" },
        { name: "Nisha Varma", mobile: `98201${companyId}0022`, email: `nisha.varma${companyId}@amazon.com`, city: "Hyderabad", employmentType: "Salaried (Operations Head)", monthlyIncome: 240000.0, panNumber: "NISHV1222V", aadhaarMasked: "XXXX-XXXX-2468" },
        { name: "Rameshwar Dayal", mobile: `98201${companyId}0023`, email: `dayal.traders${companyId}@yahoo.com`, city: "Jaipur", employmentType: "Self-Employed FMCG", monthlyIncome: 320000.0, panNumber: "RAMRD1323W", aadhaarMasked: "XXXX-XXXX-3579" },
        { name: "Sangeeta Rao", mobile: `98201${companyId}0024`, email: `sangeeta.rao${companyId}@cisco.com`, city: "Bengaluru", employmentType: "Salaried (Sr. Cloud Architect)", monthlyIncome: 275000.0, panNumber: "SANSR1424X", aadhaarMasked: "XXXX-XXXX-4680" },
        { name: "Prateek Chouhan", mobile: `98201${companyId}0025`, email: `prateek.chouhan${companyId}@ey.com`, city: "Mumbai", employmentType: "Salaried (Consultant)", monthlyIncome: 155000.0, panNumber: "PRAPC1525Y", aadhaarMasked: "XXXX-XXXX-5791" },
        { name: "Naveen Saxena", mobile: `98201${companyId}0026`, email: `naveen${companyId}@saxenapharma.in`, city: "Lucknow", employmentType: "Self-Employed Pharma", monthlyIncome: 410000.0, panNumber: "NAVNS1626Z", aadhaarMasked: "XXXX-XXXX-6802" },
        { name: "Kavita Rao", mobile: `98201${companyId}0027`, email: `kavita.rao${companyId}@oracle.com`, city: "Pune", employmentType: "Salaried (Tech Lead)", monthlyIncome: 190000.0, panNumber: "KAVKR1727A", aadhaarMasked: "XXXX-XXXX-7913" },
        { name: "Yogeshwar Sen", mobile: `98201${companyId}0028`, email: `yogesh.sen${companyId}@tatamotors.com`, city: "Mumbai", employmentType: "Salaried (Plant Head)", monthlyIncome: 210000.0, panNumber: "YOGYS1828B", aadhaarMasked: "XXXX-XXXX-8024" },
        { name: "Hemant Tiwari", mobile: `98201${companyId}0029`, email: `tiwari.logistics${companyId}@gmail.com`, city: "Indore", employmentType: "Self-Employed Transport", monthlyIncome: 370000.0, panNumber: "HEMHT1929C", aadhaarMasked: "XXXX-XXXX-9135" },
        { name: "Pallavi Soni", mobile: `98201${companyId}0030`, email: `pallavi.soni${companyId}@standardchartered.com`, city: "Jaipur", employmentType: "Salaried (Branch Operations)", monthlyIncome: 130000.0, panNumber: "PALPS2030D", aadhaarMasked: "XXXX-XXXX-0246" },
      ];

      // Add extra 30 dynamically generated names to reach 60 leads
      const firstNames = ["Raghav", "Aditya", "Sameer", "Kartik", "Simran", "Tanvi", "Bhavesh", "Nitin", "Tarun", "Karan", "Rohan", "Mitali", "Shruti", "Akash", "Varun", "Rishabh", "Parul", "Swati", "Mohit", "Deepa", "Chirag", "Jatin", "Isha", "Manan", "Vidhi", "Pranav", "Kavish", "Namrata", "Hitesh", "Ankita"];
      const lastNames = ["Kapoor", "Bhatia", "Malik", "Chopra", "Seth", "Khanna", "Trehan", "Mehta", "Dhawan", "Dua", "Garg", "Srivastava", "Mathur", "Tandon", "Arora", "Vohra", "Lamba", "Bajaj", "Grover", "Gulati", "Walia", "Sachdeva", "Khurana", "Sood", "Kundra", "Talwar", "Soni", "Ahuja", "Bhardwaj", "Chandra"];
      const citiesList = ["Jaipur", "New Delhi", "Mumbai", "Bengaluru", "Pune", "Hyderabad", "Ahmedabad", "Chandigarh", "Noida", "Gurugram"];
      const empTypes = ["Salaried (MNC)", "Self-Employed Business", "Salaried (Banking)", "Professional (CA)", "Self-Employed Retail"];

      for (let i = 0; i < 30; i++) {
        const fn = firstNames[i % firstNames.length];
        const ln = lastNames[i % lastNames.length];
        const numIdx = String(i + 31).padStart(4, "0");
        customersData.push({
          name: `${fn} ${ln}`,
          mobile: `98201${companyId}${numIdx}`,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}${companyId}@example.com`,
          city: pick(citiesList),
          employmentType: pick(empTypes),
          monthlyIncome: randInt(85, 450) * 1000,
          panNumber: `${fn.slice(0, 3).toUpperCase()}P${ln.slice(0, 1).toUpperCase()}${randInt(1000, 9999)}A`,
          aadhaarMasked: `XXXX-XXXX-${randInt(1000, 9999)}`,
        });
      }

      const loanProductPool = [
        { type: "Home Loan", minAmt: 3500000, maxAmt: 15000000 },
        { type: "Business Loan", minAmt: 2000000, maxAmt: 8500000 },
        { type: "Personal Loan", minAmt: 300000, maxAmt: 1800000 },
        { type: "Mortgage Loan", minAmt: 5000000, maxAmt: 30000000 },
        { type: "User Car Loan", minAmt: 600000, maxAmt: 2500000 },
        { type: "CC/OD", minAmt: 2500000, maxAmt: 12000000 },
        { type: "CGTMSME", minAmt: 5000000, maxAmt: 20000000 },
        { type: "Mutual Fund", minAmt: 500000, maxAmt: 3000000 },
        { type: "Insurance", minAmt: 250000, maxAmt: 1000000 },
      ];

      const statusDistribution = [
        "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED", "DISBURSED",
        "SANCTIONED", "SANCTIONED", "SANCTIONED", "SANCTIONED", "SANCTIONED", "SANCTIONED", "SANCTIONED", "SANCTIONED",
        "PASSED_TO_OPS", "PASSED_TO_OPS", "PASSED_TO_OPS", "PASSED_TO_OPS",
        "FILE_LOGIN", "FILE_LOGIN", "FILE_LOGIN", "FILE_LOGIN",
        "DOCS_PENDING", "DOCS_PENDING", "DOCS_PENDING",
        "INTERESTED", "INTERESTED", "INTERESTED", "INTERESTED", "INTERESTED",
        "FOLLOW_UP", "FOLLOW_UP", "FOLLOW_UP", "FOLLOW_UP",
        "CALL_BACK", "CALL_BACK", "CALL_BACK",
        "NEW", "NEW", "NEW", "NEW",
        "REJECTED", "REJECTED",
        "NOT_CONNECTED", "NOT_PICKED"
      ];

      const sourcePool = [
        { source: "DSA Partner", comm: 1.50 },
        { source: "Sharma DSA", comm: 1.25 },
        { source: "Pooja Finance", comm: 1.20 },
        { source: "FinTech Connect", comm: 1.40 },
        { source: "Bank Referral", comm: 1.00 },
        { source: "QuickLoan DSA", comm: 1.10 },
        { source: "Google Ads", comm: 0.80 },
        { source: "Facebook Ads", comm: 0.80 },
        { source: "Website", comm: 0.50 },
        { source: "Direct Walkin", comm: 0.0 },
      ];

      const createdLeads = [];
      const createdCustomers = [];

      for (let idx = 0; idx < customersData.length; idx++) {
        const cd = customersData[idx];

        // Create or find customer
        let [customer] = await db.Customer.findOrCreate({
          where: { companyId, mobile: cd.mobile },
          defaults: { companyId, ...cd },
        });
        createdCustomers.push(customer);

        // Assign employee & manager
        const assignedEmp = salesUsers[idx % salesUsers.length];
        const assignedMgr = assignedEmp.role === ROLES.MANAGER
          ? assignedEmp
          : (activeUsers.find((u) => u.id === assignedEmp.managerId) || salesUsers.find((u) => u.role === ROLES.MANAGER) || assignedEmp);

        const prod = loanProductPool[idx % loanProductPool.length];
        const reqAmt = Math.round(randInt(prod.minAmt, prod.maxAmt) / 50000) * 50000;
        const status = statusDistribution[idx % statusDistribution.length];
        const priority = idx % 4 === 0 ? "HIGH" : idx % 3 === 0 ? "LOW" : "MEDIUM";
        const srcItem = sourcePool[idx % sourcePool.length];
        const leadSrc = srcItem.source;
        const leadComm = srcItem.comm;

        // Realistic date spread over past 40 days
        const daysPast = Math.min(38, Math.floor((idx * 38) / customersData.length));
        const createdAtDate = daysAgo(daysPast, randInt(9, 18), randInt(0, 50));

        // Follow up dates: some today, some pending/overdue, some tomorrow/future
        let nextFollowup = null;
        if (["FOLLOW_UP", "INTERESTED", "CALL_BACK", "DOCS_PENDING"].includes(status)) {
          if (idx % 3 === 0) {
            // Today
            const today = new Date();
            today.setHours(randInt(11, 18), randInt(0, 59), 0, 0);
            nextFollowup = today;
          } else if (idx % 3 === 1) {
            // Overdue (yesterday or 2 days ago)
            nextFollowup = daysAgo(randInt(1, 4), randInt(10, 16), 0);
          } else {
            // Future / Tomorrow
            const fut = new Date();
            fut.setDate(fut.getDate() + randInt(1, 5));
            fut.setHours(randInt(11, 17), 0, 0, 0);
            nextFollowup = fut;
          }
        }

        // Find or create lead
        let lead = await db.Lead.findOne({
          where: { companyId, customerId: customer.id },
        });

        if (!lead) {
          lead = await db.Lead.create({
            companyId,
            customerId: customer.id,
            leadSource: leadSrc,
            loanType: prod.type,
            requiredAmount: reqAmt,
            assignedEmployeeId: assignedEmp.id,
            assignedManagerId: assignedMgr.id,
            status: status,
            priority: priority,
            nextFollowupDate: nextFollowup,
            commissionPercent: leadComm,
            createdAt: createdAtDate,
            updatedAt: new Date(createdAtDate.getTime() + 1000 * 60 * randInt(30, 400)),
          });
        } else {
          await lead.update({
            leadSource: leadSrc,
            loanType: prod.type,
            requiredAmount: reqAmt,
            assignedEmployeeId: assignedEmp.id,
            assignedManagerId: assignedMgr.id,
            status: status,
            priority: priority,
            nextFollowupDate: nextFollowup,
            commissionPercent: leadComm,
          });
        }

        createdLeads.push({ lead, customer, assignedEmp, prod, reqAmt, status, createdAtDate, leadSrc, leadComm });
      }

      // 6. CALL LOGS
      console.log("6. Seeding Comprehensive Telecalling Call Logs (120+ Records)...");
      const callStatuses = ["CONNECTED", "CONNECTED", "CONNECTED", "CONNECTED", "BUSY", "CALL_BACK_LATER", "NOT_PICKED", "NOT_PICKED"];
      const remarksPool = [
        "Spoke to customer. Explained Home Loan balance transfer benefits from SBI to HDFC with 8.40% ROI. Customer showed keen interest and requested amortization chart on WhatsApp.",
        "Detailed discussion regarding Business Expansion loan of ₹50L. Client confirmed turnover of ₹3.2 Cr in last FY with clean GST filing. Document collection scheduled.",
        "Customer was in a client meeting. Requested callback tomorrow after 4:00 PM to discuss Personal Loan tenure & EMI options.",
        "Verified KYC details and eligibility criteria. Advised to maintain banking average balance. Client sending last 6 months statement.",
        "Followed up for pending 2 years ITR and GST 3B returns. Client promised to share files by end of day via email.",
        "Explained property valuation and legal clearance process for Mortgage Loan (LAP). Client agreed to proceed with technical inspection.",
        "Customer enquired about top-up loan options on existing home loan. Shared processing fee waiver details and sanctioned quotation.",
        "Call disconnected due to network issue. Retried after 5 mins and concluded discussions on interest rate concession.",
        "Discussed CC/OD working capital limit requirements. Client wants ₹75 Lakh limit against industrial property collateral.",
        "Informed customer that sanction letter is released from ICICI Bank. Explained disbursement kit signing procedure."
      ];

      for (let i = 0; i < createdLeads.length; i++) {
        const item = createdLeads[i];
        const numCalls = randInt(1, 4);

        for (let c = 0; c < numCalls; c++) {
          const callStatus = pick(callStatuses);
          const duration = callStatus === "CONNECTED" ? randInt(45, 380) : 0;
          const remarks = callStatus === "CONNECTED" ? pick(remarksPool) : `Call attempted. Status: ${callStatus}.`;
          const callDate = daysAgo(randInt(0, 25), randInt(10, 19), randInt(0, 59));

          await db.CallLog.create({
            companyId,
            leadId: item.lead.id,
            userId: item.assignedEmp.id,
            callStatus,
            durationSec: duration,
            remarks,
            createdAt: callDate,
            updatedAt: callDate,
          });
        }
      }

      // 7. TASKS & FOLLOW-UPS
      console.log("7. Seeding Tasks, Reminders & Follow-Ups...");
      const taskTitles = [
        "Collect Physical KYC & Property Title Chain documents from client residence",
        "Coordinate with HDFC Bank Credit Manager for fast-track loan sanction approval",
        "Submit signed Disbursement Kit & NACH mandate form to ICICI Operations desk",
        "Generate ROI comparison sheet & amortization schedule for client review",
        "Complete field verification & residential property inspection follow-up",
        "Collect audited balance sheet and GST returns for business turnover verification",
        "Verify bank statements analysis report and calculate Debt-to-Income (FOIR) ratio",
        "Follow up with client for legal search report & property tax receipt copy"
      ];

      for (let i = 0; i < createdLeads.length; i++) {
        const item = createdLeads[i];

        if (i % 2 === 0) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + randInt(-3, 7));
          dueDate.setHours(randInt(11, 18), 0, 0, 0);

          await db.Task.create({
            companyId,
            userId: item.assignedEmp.id,
            leadId: item.lead.id,
            title: pick(taskTitles),
            description: `Follow up task assigned for ${item.customer.name} for ${item.lead.loanType} requirement of ₹${(item.reqAmt / 100000).toFixed(1)} Lakhs.`,
            dueDate,
            priority: pick(["HIGH", "MEDIUM", "LOW"]),
            status: pick(["PENDING", "IN_PROGRESS", "COMPLETED"]),
            createdAt: daysAgo(randInt(1, 15)),
          });
        }

        if (i % 3 === 0) {
          const schedDate = new Date();
          schedDate.setDate(schedDate.getDate() + randInt(-2, 5));
          schedDate.setHours(randInt(10, 18), randInt(0, 59), 0, 0);

          await db.FollowUp.create({
            companyId,
            leadId: item.lead.id,
            userId: item.assignedEmp.id,
            scheduledAt: schedDate,
            reminderType: pick(["15m", "30m", "1h", "same_day"]),
            status: schedDate < new Date() ? "COMPLETED" : "PENDING",
            remarks: `Scheduled telephonic discussion with ${item.customer.name} regarding loan sanction status.`,
            createdAt: daysAgo(randInt(1, 10)),
          });
        }
      }

      // 8. LOAN APPLICATIONS & DOCUMENTS (OPERATIONS & BANKER WORKFLOW)
      console.log("8. Seeding Loan Applications, KYC Documents & Banker Queries...");

      const opsLeads = createdLeads.filter((item) =>
        ["PASSED_TO_OPS", "DOCS_PENDING", "FILE_LOGIN", "SANCTIONED", "DISBURSED"].includes(item.status)
      );

      const appStatusMap = {
        DOCS_PENDING: "DOCS_PENDING",
        FILE_LOGIN: "LOGGED_IN",
        PASSED_TO_OPS: "UNDERWRITING",
        SANCTIONED: "SANCTIONED",
        DISBURSED: "DISBURSED",
      };

      for (let i = 0; i < opsLeads.length; i++) {
        const item = opsLeads[i];
        const lender = lenders[i % lenders.length];
        const assignedBanker = bankerUsers[i % bankerUsers.length] || activeUsers[0];
        const appStatus = appStatusMap[item.status] || "UNDERWRITING";
        const appNum = `APP-2026-0${companyId}${String(i + 101).padStart(3, "0")}`;

        const appliedAmt = item.reqAmt;
        const sanctionedAmt = ["SANCTIONED", "DISBURSED"].includes(appStatus) ? appliedAmt : null;
        const disbursedAmt = appStatus === "DISBURSED" ? appliedAmt : null;

        let [app] = await db.Application.findOrCreate({
          where: { companyId, applicationNumber: appNum },
          defaults: {
            companyId,
            leadId: item.lead.id,
            customerId: item.customer.id,
            applicationNumber: appNum,
            loanProduct: item.prod.type,
            appliedAmount: appliedAmt,
            sanctionedAmount: sanctionedAmt,
            disbursedAmount: disbursedAmt,
            assignedBankerId: assignedBanker ? assignedBanker.id : null,
            lenderId: lender.id,
            status: appStatus,
            createdAt: item.createdAtDate,
          },
        });

        // Seed KYC Documents for this application & lead
        const docTypes = ["PAN", "AADHAAR", "SALARY_SLIP", "BANK_STATEMENT", "ITR"];
        for (const dt of docTypes) {
          await db.Document.findOrCreate({
            where: {
              companyId,
              customerId: item.customer.id,
              docType: dt,
            },
            defaults: {
              companyId,
              customerId: item.customer.id,
              leadId: item.lead.id,
              applicationId: app.id,
              docType: dt,
              fileUrl: `/uploads/docs/${dt.toLowerCase()}_${item.customer.id}.pdf`,
              fileName: `${item.customer.name.replace(/\s+/g, "_")}_${dt}.pdf`,
              uploadedBy: item.assignedEmp.id,
              verificationStatus: appStatus === "DISBURSED" || appStatus === "SANCTIONED" ? "VERIFIED" : "PENDING",
              verifiedBy: opsUsers[0]?.id || null,
              createdAt: item.createdAtDate,
            },
          });
        }

        // Seed Banker Queries if under review
        if (i % 2 === 0) {
          const queryTexts = [
            "Please upload latest 3 months salary slips with official HR seal & signature.",
            "Address mismatch noted between Aadhaar Card and current residence electricity bill. Please furnish registered rent agreement copy.",
            "Bank statement analysis shows EMI bounce for ₹12,500 in March 2026. Please share clearance memo or bank confirmation.",
            "Valuation report completed by bank empaneled architect. Requesting clearance on property chain deeds from 2012.",
            "Please confirm if business GST turnover includes inter-company transfers or only external customer invoices."
          ];

          const queryStatus = i % 4 === 0 ? "OPEN" : "RESOLVED";

          await db.BankerQuery.create({
            companyId,
            applicationId: app.id,
            bankerId: assignedBanker ? assignedBanker.id : activeUsers[0].id,
            queryText: pick(queryTexts),
            status: queryStatus,
            responseText: queryStatus === "RESOLVED" ? "Document verified with customer and uploaded in portal. Clarification received." : null,
            resolvedByOpsId: queryStatus === "RESOLVED" ? (opsUsers[0]?.id || activeUsers[0].id) : null,
            createdAt: daysAgo(randInt(1, 8)),
          });
        }
      }

      // 9. STAFF DAILY ATTENDANCE (PAST 30 DAYS)
      console.log("9. Seeding Daily GPS Attendance Records for Staff...");
      const attendanceUsers = activeUsers.filter(
        (u) => u.role === ROLES.EMPLOYEE || u.role === ROLES.MANAGER || u.role === ROLES.OPS
      );

      for (let d = 0; d < 30; d++) {
        const attDateObj = daysAgo(d);
        const dayOfWeek = attDateObj.getDay();
        if (dayOfWeek === 0) continue; // Skip Sundays

        const attDate = dateStr(attDateObj);

        for (const emp of attendanceUsers) {
          const empBranch = branches.find((b) => b.id === emp.branchId) || defaultBranch;

          // Attendance status: 85% Present, 10% Late, 5% Half-day
          const rand = Math.random();
          let status = "PRESENT";
          let checkInHour = 9;
          let checkInMin = randInt(5, 25);
          let checkOutHour = 18;
          let checkOutMin = randInt(15, 45);
          let workingHours = 8.8;

          if (rand > 0.90) {
            status = "LATE";
            checkInHour = 10;
            checkInMin = randInt(5, 30);
            workingHours = 8.1;
          } else if (rand > 0.85) {
            status = "HALF_DAY";
            checkOutHour = 14;
            workingHours = 4.5;
          }

          const checkInTime = new Date(attDateObj);
          checkInTime.setHours(checkInHour, checkInMin, randInt(0, 59), 0);

          const checkOutTime = new Date(attDateObj);
          checkOutTime.setHours(checkOutHour, checkOutMin, randInt(0, 59), 0);

          // Office coordinates with slight realistic GPS drift (< 50m)
          const checkInLat = Number(empBranch.officeLat) + (Math.random() - 0.5) * 0.0003;
          const checkInLng = Number(empBranch.officeLng) + (Math.random() - 0.5) * 0.0003;

          await db.Attendance.findOrCreate({
            where: { companyId, userId: emp.id, date: attDate },
            defaults: {
              companyId,
              userId: emp.id,
              date: attDate,
              checkInTime,
              checkInLat,
              checkInLng,
              checkOutTime,
              checkOutLat: checkInLat,
              checkOutLng: checkInLng,
              workingHours,
              status,
              isManualOverride: false,
            },
          });
        }
      }

      // 10. ACTIVITY LOGS & AUDIT TRAILS
      console.log("10. Seeding System Activity Audit Logs & Live Notifications...");
      const activityActions = [
        { action: "CREATED", recordType: "Lead", remarks: "Fresh lead created from Google Ads marketing campaign." },
        { action: "STATUS_CHANGED", recordType: "Lead", remarks: "Lead status updated to INTERESTED after telephonic consultation." },
        { action: "ASSIGNED", recordType: "Lead", remarks: "Lead assigned to senior loan specialist for KYC pickup." },
        { action: "DOC_UPLOADED", recordType: "Document", remarks: "Applicant 6 months bank statement uploaded for credit appraisal." },
        { action: "VERIFIED", recordType: "Document", remarks: "KYC PAN and Aadhaar identity successfully verified by Operations desk." },
        { action: "STATUS_CHANGED", recordType: "Application", remarks: "Loan application file logged in HDFC Bank partner system." },
        { action: "DISBURSED", recordType: "Application", remarks: "Loan successfully disbursed to applicant bank account." },
      ];

      for (let i = 0; i < 40; i++) {
        const act = pick(activityActions);
        const actor = pick(activeUsers);
        const logDate = daysAgo(randInt(0, 20), randInt(9, 19), randInt(0, 59));

        await db.ActivityLog.create({
          companyId,
          recordType: act.recordType,
          recordId: randInt(1, 30),
          action: act.action,
          remarks: act.remarks,
          actorUserId: actor.id,
          sourcePanel: pick(["Admin Panel", "Mobile App", "Ops Portal"]),
          ipAddress: `192.168.1.${randInt(10, 150)}`,
          createdAt: logDate,
        });
      }

      // Notifications
      for (const emp of activeUsers) {
        await db.Notification.create({
          companyId,
          recipientId: emp.id,
          title: "New High-Value Lead Assigned",
          message: "A new Home Loan opportunity of ₹85.0 Lakhs has been allocated to you for customer follow-up.",
          type: "lead_assigned",
          recordId: 1,
          isRead: pick([true, false]),
          createdAt: daysAgo(randInt(0, 5)),
        });

        await db.Notification.create({
          companyId,
          recipientId: emp.id,
          title: "Sanction Letter Issued",
          message: "Congratulations! Application APP-2026-001 has received credit sanction from HDFC Bank.",
          type: "query_raised",
          recordId: 2,
          isRead: false,
          createdAt: daysAgo(randInt(0, 2)),
        });
      }

      // 11. CASE PAYOUTS, DISBURSEMENTS, INVOICES & BANK RECEIPTS
      console.log("11. Seeding Disbursed Case Payouts, Invoices, Bank Receipts & Payouts...");

      // Clear existing records for clean idempotent seeding
      await db.BankReceipt.destroy({ where: { companyId } });
      await db.PartyPayment.destroy({ where: { companyId } });
      await db.Expense.destroy({ where: { companyId } });

      const payoutLeads = createdLeads.filter((item) =>
        ["DISBURSED", "SANCTIONED"].includes(item.status)
      );

      const sourceConfigMap = new Map();
      const currentSourceConfigs = await db.MasterConfig.findAll({
        where: { companyId, configType: "LEAD_SOURCE" },
      });
      currentSourceConfigs.forEach((sc) => {
        sourceConfigMap.set((sc.label || "").toLowerCase(), sc);
        sourceConfigMap.set((sc.value || "").toLowerCase(), sc);
      });

      for (let pIdx = 0; pIdx < payoutLeads.length; pIdx++) {
        const item = payoutLeads[pIdx];
        const lender = lenders[pIdx % lenders.length];
        const sourceConfig = sourceConfigMap.get((item.lead.leadSource || "").toLowerCase());

        const loanAmount = parseFloat(item.reqAmt);
        const bankCommPct = parseFloat(lender.payoutCommissionPercent) || 1.50;
        // Base Amount = Incoming / Credit Amount from Bank = (Loan Amount * Bank Comm %) / 100
        const baseAmount = Math.round((loanAmount * bankCommPct) / 100);
        const bankCommDue = baseAmount;

        const partyName = item.lead.leadSource || "DSA Partner";
        const partyCode = sourceConfig?.code || `PTY-${String((pIdx % 6) + 1).padStart(3, "0")}`;
        // Party commission % (applied on base value / credit amount)
        const partyCommPct = 50.0;
        const partyCommDue = Math.round((baseAmount * partyCommPct) / 100);

        const partyTdsPercent = 5.0;
        const partyTdsAmount = Math.round((partyCommDue * partyTdsPercent) / 100);
        const partyGstPercent = 0.0;
        const partyGstAmount = 0.0;
        const extraCharges = pIdx % 3 === 0 ? 500 : 0; // staff incentive / operational deduction

        const partyNetPayable = Math.max(0, partyCommDue - partyTdsAmount - partyGstAmount - extraCharges);

        // Status distribution:
        // pIdx % 3 === 0: SETTLED (full bank received & full party paid)
        // pIdx % 3 === 1: PARTIALLY_SETTLED (bank received, partial party paid)
        // pIdx % 3 === 2: PENDING (bank due, party due)
        let caseStatus = "SETTLED";
        let bankReceived = bankCommDue;
        let partyPaid = partyNetPayable;

        if (pIdx % 3 === 1) {
          caseStatus = "PARTIALLY_SETTLED";
          bankReceived = bankCommDue;
          partyPaid = Math.round(partyNetPayable * 0.5);
        } else if (pIdx % 3 === 2) {
          caseStatus = "PENDING";
          bankReceived = 0;
          partyPaid = 0;
        }

        const bankRemaining = Math.max(0, bankCommDue - bankReceived);
        const partyRemaining = Math.max(0, partyNetPayable - partyPaid);
        const netMargin = Math.round(baseAmount - partyNetPayable);

        const disbursalDaysAgo = Math.min(32, (pIdx * 2) + 2);
        const disbursalDate = dateStr(daysAgo(disbursalDaysAgo));
        const invoiceNumber = `INV-2026-${companyId}${String(pIdx + 101).padStart(3, "0")}`;
        const invoiceDate = disbursalDate;
        const invoiceStatus = caseStatus === "SETTLED" ? "PAID" : caseStatus === "PARTIALLY_SETTLED" ? "ISSUED" : "DRAFT";

        const primaryApp = await db.Application.findOne({
          where: { companyId, leadId: item.lead.id },
        });

        let [casePayout] = await db.CasePayout.findOrCreate({
          where: { companyId, leadId: item.lead.id },
          defaults: {
            companyId,
            leadId: item.lead.id,
            applicationId: primaryApp ? primaryApp.id : null,
            customerName: item.customer.name,
            customerMobile: item.customer.mobile,
            loanProduct: item.prod.type,
            bankName: lender.name,
            lenderId: lender.id,
            disbursalDate,
            loanAmount,
            baseAmount,
            bankCommissionPercent: bankCommPct,
            bankCommissionDue: bankCommDue,
            bankGstPercent: 18.0,
            bankTdsPercent: 5.0,
            bankReceivedAmount: bankReceived,
            bankRemainingDue: bankRemaining,
            partyName,
            partyCode,
            partyCommissionPercent: partyCommPct,
            partyCommissionDue: partyCommDue,
            partyTdsPercent,
            partyTdsAmount,
            partyGstPercent,
            partyGstAmount,
            extraCharges,
            partyNetPayable,
            partyPaidAmount: partyPaid,
            partyRemainingDue: partyRemaining,
            netMargin,
            invoiceNumber,
            invoiceDate,
            invoiceStatus,
            status: caseStatus,
            notes: `Disbursed under ${lender.name} partner program. Case managed by ${item.assignedEmp.name}.`,
          },
        });

        await casePayout.update({
          customerName: item.customer.name,
          customerMobile: item.customer.mobile,
          loanProduct: item.prod.type,
          bankName: lender.name,
          lenderId: lender.id,
          disbursalDate,
          loanAmount,
          baseAmount,
          bankCommissionPercent: bankCommPct,
          bankCommissionDue: bankCommDue,
          bankReceivedAmount: bankReceived,
          bankRemainingDue: bankRemaining,
          partyName,
          partyCode,
          partyCommissionPercent: partyCommPct,
          partyCommissionDue: partyCommDue,
          partyTdsPercent,
          partyTdsAmount,
          partyGstPercent,
          partyGstAmount,
          extraCharges,
          partyNetPayable,
          partyPaidAmount: partyPaid,
          partyRemainingDue: partyRemaining,
          netMargin,
          invoiceNumber,
          invoiceDate,
          invoiceStatus,
          status: caseStatus,
        });

        // Seed BankReceipt if bankReceived > 0
        if (bankReceived > 0) {
          const receiptDate = dateStr(daysAgo(Math.max(1, disbursalDaysAgo - 2)));
          await db.BankReceipt.create({
            companyId,
            casePayoutId: casePayout.id,
            leadId: item.lead.id,
            bankName: lender.name,
            grossAmount: bankReceived,
            gstAmount: Math.round(bankReceived * 0.18),
            tdsAmount: Math.round(bankReceived * 0.05),
            netAmount: Math.round(bankReceived * (1 + 0.18 - 0.05)),
            receiptDate,
            paymentMode: "NEFT",
            referenceNumber: `UTR${randInt(100000000000, 999999999999)}`,
            notes: `Commission payment received from ${lender.name} for Application #${item.lead.id}`,
            recordedById: opsUsers[0]?.id || activeUsers[0].id,
          });
        }

        // Seed PartyPayment (LINKED_PAYMENT) if partyPaid > 0
        if (partyPaid > 0) {
          const payDate = dateStr(daysAgo(Math.max(1, disbursalDaysAgo - 3)));
          await db.PartyPayment.create({
            companyId,
            partyName,
            partyCode,
            leadId: item.lead.id,
            paymentType: "LINKED_PAYMENT",
            amount: partyPaid,
            paymentDate: payDate,
            paymentMode: "BANK_TRANSFER",
            referenceNumber: `UTR${randInt(100000000000, 999999999999)}`,
            notes: `Disbursement commission payout for Lead #${item.lead.id} (${item.customer.name})`,
            recordedById: opsUsers[0]?.id || activeUsers[0].id,
          });
        }
      }

      // 12. PARTY / CONNECTOR ADVANCES & REFUND CREDITS
      console.log("12. Seeding Party / Connector Unallocated Advances & Refund Credits...");

      const connectorAdvanceList = [
        { partyName: "DSA Partner", partyCode: "PTY-001", paymentType: "ADVANCE", amount: 45000, days: 12, notes: "Advance commission transfer against upcoming home loan file pipeline" },
        { partyName: "Sharma DSA", partyCode: "PTY-002", paymentType: "ADVANCE", amount: 30000, days: 8, notes: "Advance payout credited for priority file processing" },
        { partyName: "Pooja Finance", partyCode: "PTY-003", paymentType: "ADVANCE", amount: 25000, days: 15, notes: "Quarterly retainer advance payment" },
        { partyName: "FinTech Connect", partyCode: "PTY-004", paymentType: "ADVANCE", amount: 50000, days: 5, notes: "Advance deposit for digital lead intake" },
        { partyName: "DSA Partner", partyCode: "PTY-001", paymentType: "REFUND_CREDIT", amount: 5000, days: 3, notes: "Client processing fee reversal adjustment / refund credit" },
      ];

      for (const adv of connectorAdvanceList) {
        await db.PartyPayment.create({
          companyId,
          partyName: adv.partyName,
          partyCode: adv.partyCode,
          leadId: null,
          paymentType: adv.paymentType,
          amount: adv.amount,
          paymentDate: dateStr(daysAgo(adv.days)),
          paymentMode: "BANK_TRANSFER",
          referenceNumber: `UTR${randInt(100000000000, 999999999999)}`,
          notes: adv.notes,
          recordedById: opsUsers[0]?.id || activeUsers[0].id,
        });
      }

      // 13. COMPREHENSIVE OFFICE RUNNING EXPENSES (EXPENSE TRACKER)
      console.log("13. Seeding Comprehensive Office Running Expenses (Expense Tracker)...");

      const currentYear = new Date().getFullYear();
      const currentMonthNum = new Date().getMonth() + 1; // 1-12
      const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, "0")}`;
      
      const prev1MonthNum = currentMonthNum === 1 ? 12 : currentMonthNum - 1;
      const prev1Year = currentMonthNum === 1 ? currentYear - 1 : currentYear;
      const prevMonthStr = `${prev1Year}-${String(prev1MonthNum).padStart(2, "0")}`;

      const prev2MonthNum = prev1MonthNum === 1 ? 12 : prev1MonthNum - 1;
      const prev2Year = prev1MonthNum === 1 ? prev1Year - 1 : prev1Year;
      const prev2MonthStr = `${prev2Year}-${String(prev2MonthNum).padStart(2, "0")}`;

      const expenseTemplates = [
        {
          category: "Office Rent",
          vendorName: "Apex Commercial Towers Realty Ltd.",
          description: "Monthly lease rent for 4th Floor Corporate Headquarters & Operations Hub",
          baseAmount: 85000.0,
          gstPercent: 18.0,
          paymentMode: "BANK_TRANSFER",
          dayOfMonth: 5,
        },
        {
          category: "Electricity & Utility",
          vendorName: "Jaipur Vidyut Vitran Nigam Ltd. (JVVNL)",
          description: "Commercial power & electricity consumption utility bill",
          baseAmount: 14850.0,
          gstPercent: 0.0,
          paymentMode: "UPI",
          dayOfMonth: 10,
        },
        {
          category: "Tea, Coffee & Pantry",
          vendorName: "Chai Point & Daily Pantry Supplies",
          description: "Monthly staff pantry refreshment, tea, coffee beans & mineral water cans",
          baseAmount: 8400.0,
          gstPercent: 5.0,
          paymentMode: "UPI",
          dayOfMonth: 12,
        },
        {
          category: "Internet & Phone",
          vendorName: "Airtel Enterprise Telecommunications",
          description: "Dedicated leased line 300 Mbps fiber & corporate CUG mobile connections",
          baseAmount: 6800.0,
          gstPercent: 18.0,
          paymentMode: "CREDIT_CARD",
          dayOfMonth: 8,
        },
        {
          category: "Software & Subscriptions",
          vendorName: "Google Workspace, AWS Cloud & Exotel Dialler",
          description: "Cloud server infrastructure, CRM business emails and telephony dialler credits",
          baseAmount: 13500.0,
          gstPercent: 18.0,
          paymentMode: "CREDIT_CARD",
          dayOfMonth: 2,
        },
        {
          category: "Stationery & Printing",
          vendorName: "Reliable Printers & Office Supplies",
          description: "Loan agreement legal dossier files, KYC verification forms & stamp papers",
          baseAmount: 5600.0,
          gstPercent: 12.0,
          paymentMode: "UPI",
          dayOfMonth: 16,
        },
        {
          category: "Travel & Fuel",
          vendorName: "Indian Oil Corporation / Conveyance Reimbursements",
          description: "Field credit verification officers travel allowance & local client visits fuel",
          baseAmount: 9200.0,
          gstPercent: 0.0,
          paymentMode: "UPI",
          dayOfMonth: 22,
        },
        {
          category: "Office Maintenance",
          vendorName: "CleanPro Integrated Facility Services",
          description: "Bi-weekly deep cleaning, HVAC / AC unit servicing and pest management",
          baseAmount: 7200.0,
          gstPercent: 18.0,
          paymentMode: "BANK_TRANSFER",
          dayOfMonth: 18,
        },
        {
          category: "Marketing & Advertising",
          vendorName: "Meta Ads & Google Performance Ads",
          description: "Digital customer acquisition, Google search campaign & Facebook lead generation",
          baseAmount: 48000.0,
          gstPercent: 18.0,
          paymentMode: "BANK_TRANSFER",
          dayOfMonth: 15,
        },
        {
          category: "Legal & Accounting",
          vendorName: "Singhal & Associates Chartered Accountants",
          description: "Monthly GST return filings, TDS compliance and statutory audit fee",
          baseAmount: 15000.0,
          gstPercent: 18.0,
          paymentMode: "CHEQUE",
          dayOfMonth: 25,
        },
        {
          category: "Miscellaneous",
          vendorName: "Local Market Stores & Hardware Supplies",
          description: "Emergency electrical fittings, sanitization dispensers and pantry utensils",
          baseAmount: 3200.0,
          gstPercent: 0.0,
          paymentMode: "CASH",
          dayOfMonth: 28,
        },
      ];

      const monthsToSeed = [
        { monthStr: prev2MonthStr, year: prev2Year, month: prev2MonthNum },
        { monthStr: prevMonthStr, year: prev1Year, month: prev1MonthNum },
        { monthStr: currentMonthStr, year: currentYear, month: currentMonthNum },
      ];

      let expGlobalCount = 1;

      for (const mObj of monthsToSeed) {
        for (let eIdx = 0; eIdx < expenseTemplates.length; eIdx++) {
          const tmpl = expenseTemplates[eIdx];
          const expDate = `${mObj.year}-${String(mObj.month).padStart(2, "0")}-${String(Math.min(28, tmpl.dayOfMonth)).padStart(2, "0")}`;
          const gstAmt = Math.round((tmpl.baseAmount * tmpl.gstPercent) / 100);
          const totalAmt = Math.round(tmpl.baseAmount + gstAmt);
          const expCode = `EXP-${mObj.year}-${String(expGlobalCount).padStart(4, "0")}`;
          expGlobalCount++;

          // In the current month, mark 2 expenses as PENDING to show status badge filter in UI
          const isCurrentMonth = mObj.monthStr === currentMonthStr;
          const status = isCurrentMonth && (eIdx === 1 || eIdx === 7) ? "PENDING" : "PAID";

          await db.Expense.create({
            companyId,
            expenseCode: expCode,
            expenseDate: expDate,
            expenseMonth: mObj.monthStr,
            title: tmpl.description,
            category: tmpl.category,
            amount: totalAmt,
            vendorName: tmpl.vendorName,
            description: tmpl.description,
            baseAmount: tmpl.baseAmount,
            gstPercent: tmpl.gstPercent,
            gstAmount: gstAmt,
            totalAmount: totalAmt,
            paymentMode: tmpl.paymentMode,
            status,
            remarks: status === "PAID" ? `Cleared via ${tmpl.paymentMode}. Invoice verified.` : "Approval pending with Branch Manager.",
            createdById: activeUsers[0].id,
          });
        }
      }

      console.log(`✓ Finished seeding Company [ID: ${companyId}].`);
    }

    console.log("\n=================================================");
    console.log("  ALL DEMO DATA SEEDED SUCCESSFULLY! 📸 ✨        ");
    console.log("=================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("FATAL ERROR in runMarketingSeeder:", err);
    process.exit(1);
  }
}

runMarketingSeeder();
