require("dotenv").config();
const db = require("./models");
const { DEFAULT_MASTER_CONFIGS } = require("./constants/defaultMasterConfigs");

const syncAndSeed = async () => {
  try {
    console.log("Connecting to database...");
    await db.sequelize.authenticate();
    console.log("Database connection successful.");

    const force = process.argv.includes("--force");
    const alter = !force;

    if (force) {
      console.log("Dropping all existing tables for a clean start...");
      await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0;");
      const [tables] = await db.sequelize.query("SHOW TABLES;");
      for (const tableObj of tables) {
        const tableName = Object.values(tableObj)[0];
        console.log(`- Dropping table: ${tableName}`);
        await db.sequelize.query(`DROP TABLE IF EXISTS \`${tableName}\`;`);
      }
      await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");
      console.log("All old tables dropped.");
    }

    console.log(`Syncing schema (force: ${force}, alter: ${alter})...`);
    await db.sequelize.sync({ force, alter });
    console.log("All 16+ SaaS Tables synchronized successfully!");

    // Seed Initial Platform Data
    console.log("\nSeeding Initial Platform Data...");

    // 1. Seed Plans
    const [starterPlan] = await db.Plan.findOrCreate({
      where: { name: "Starter" },
      defaults: {
        name: "Starter",
        priceMonthly: 1999.0,
        maxEmployees: 10,
        featuresJson: { calling: true, leads: true, ops: false, bankerPortal: false },
      },
    });

    const [enterprisePlan] = await db.Plan.findOrCreate({
      where: { name: "Enterprise" },
      defaults: {
        name: "Enterprise",
        priceMonthly: 9999.0,
        maxEmployees: 100,
        featuresJson: { calling: true, leads: true, ops: true, bankerPortal: true, gpsAttendance: true },
      },
    });

    // 2. Seed Super Admin
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "superadmin@crm.com";
    let superAdmin = await db.User.findOne({ where: { role: "SUPERADMIN" } });
    if (!superAdmin) {
      superAdmin = await db.User.create({
        name: "System Super Admin",
        email: superAdminEmail,
        phone: "9876543210",
        password: process.env.SUPER_ADMIN_PASSWORD || "Admin@123456",
        role: "SUPERADMIN",
        status: "active",
        companyId: null,
      });
      console.log(`- SuperAdmin created: ${superAdmin.email}`);
    }

    // 3. Seed Default Demo Company
    let defaultCompany = await db.Company.findOne({ where: { slug: "capitalcare" } });
    if (!defaultCompany) {
      defaultCompany = await db.Company.create({
        name: "CapitalCare Financial Services",
        slug: "capitalcare",
        email: "contact@capitalcare.com",
        phone: "9876543211",
        planId: enterprisePlan.id,
        status: "active",
        maxUsers: 50,
      });
      console.log(`- Default Company created: ${defaultCompany.name} (ID: ${defaultCompany.id})`);
    }

    // 4. Seed Default Branch
    let defaultBranch = await db.Branch.findOne({ where: { companyId: defaultCompany.id } });
    if (!defaultBranch) {
      defaultBranch = await db.Branch.create({
        companyId: defaultCompany.id,
        name: "Headquarters - Jaipur",
        city: "Jaipur",
        state: "Rajasthan",
        address: "Corporate Financial Hub, Floor 4",
        officeLat: 26.9124,
        officeLng: 75.7873,
        geoRadiusMeters: 300,
        workStartTime: "09:30",
        workEndTime: "18:30",
        lateBufferMinutes: 15,
        halfDayHours: 4.5,
      });
      console.log(`- Default Branch created: ${defaultBranch.name}`);
    }

    // 5. Seed Company Admin
    let companyAdmin = await db.User.findOne({
      where: { companyId: defaultCompany.id, role: "COMPANY_ADMIN" },
    });
    if (!companyAdmin) {
      companyAdmin = await db.User.create({
        companyId: defaultCompany.id,
        branchId: defaultBranch.id,
        name: "Company Admin",
        email: "admin@capitalcare.com",
        phone: "9876543212",
        password: "Admin@123456",
        role: "COMPANY_ADMIN",
        status: "active",
      });
      console.log(`- Company Admin created: admin@capitalcare.com / Admin@123456`);
    }

    // 6. Seed Sample Master Configs (Lead Statuses, Loan Products, Doc Types)
    const defaultConfigs = DEFAULT_MASTER_CONFIGS;

    for (const cfg of defaultConfigs) {
      await db.MasterConfig.findOrCreate({
        where: {
          companyId: defaultCompany.id,
          configType: cfg.configType,
          value: cfg.value,
        },
        defaults: {
          companyId: defaultCompany.id,
          ...cfg,
        },
      });
    }
    console.log(`- Default Master Configs initialized.`);

    console.log("\nSetup completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Setup failed:", error);
    process.exit(1);
  }
};

syncAndSeed();
