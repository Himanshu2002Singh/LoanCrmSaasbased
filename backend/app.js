require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

const db = require("./models");
const routes = require("./routes");

const app = express();
const port = process.env.PORT || 3006;

app.set("trust proxy", true);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads/documents", express.static(path.join(__dirname, "uploads", "documents")));
app.use("/uploads/logos", express.static(path.join(__dirname, "uploads", "logos")));
app.use("/uploads/templates", express.static(path.join(__dirname, "uploads", "templates")));
app.use("/uploads/docs", express.static(path.join(__dirname, "uploads", "documents")));
app.use("/uploads", express.static(path.join(__dirname, "uploads", "documents")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => res.json({ service: "CapitalCare CRM API", status: "running" }));

app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Central error handler, so a controller can `next(err)` instead of repeating
// the same try/catch response shape.
app.use((err, req, res, next) => {
  console.error("[error]", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

const start = async () => {
  try {
    await db.sequelize.authenticate();
    console.log("Database connection established.");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }

  app.listen(port, () => console.log(`Server started at :${port}`));
};

start();

module.exports = app;
