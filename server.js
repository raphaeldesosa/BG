const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

// ------------------- DATABASE -------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ------------------- ADMIN TOKEN -------------------
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "supersecret123";

// ------------------- API ROUTES -------------------

// Add member
app.post("/client", async (req, res) => {
  const { fullName, email, contactNumber, dsjNumber } = req.body;

  if (!fullName || !email || !contactNumber || !dsjNumber) {
    return res.status(400).json({ error: "All fields required" });
  }

  const borrowAmount = 100;
  const borrowDate = new Date();
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 2);

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
    if (err.code === "23505") {
      return res.status(400).json({ error: "This DSJ account number is already registered." });
    }
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Admin login
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "adminpass0205") {
    return res.json({ token: ADMIN_TOKEN });
  }
  return res.status(401).json({ error: "Invalid credentials" });
});

// Get all clients (admin only)
app.get("/clients", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      "SELECT id, full_name, email, contact_number, dsj_number, borrow_amount, borrow_date, due_date FROM clients ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Delete member (admin only)
app.delete("/client/:id", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Unauthorized" });

  try {
    await pool.query("DELETE FROM clients WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));