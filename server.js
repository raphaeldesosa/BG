const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Admin token
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "supersecret123";

// ------------------- ROUTES -------------------

// Add member (auto $100 borrow, due date 2 months later)
app.post("/client", async (req, res) => {
  const { fullName, email, contactNumber, dsjNumber } = req.body;
  if (!fullName || !email || !contactNumber || !dsjNumber) {
    return res.status(400).json({ error: "All fields required" });
  }

  const borrowAmount = 100; // fixed borrow
  const borrowDate = new Date();
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 2); // 2 months from now

  try {
    const result = await pool.query(
      `INSERT INTO clients 
       (full_name, email, contact_number, dsj_number, borrow_amount, borrow_date, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [fullName, email, contactNumber, dsjNumber, borrowAmount, borrowDate, dueDate]
    );
    res.json({ client: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all clients (admin only)
app.get("/clients", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const result = await pool.query(
      "SELECT id, full_name, email, contact_number, dsj_number, borrow_amount, borrow_date, due_date FROM clients ORDER BY created_at DESC"
    );
    res.json({ clients: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- START SERVER -------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
