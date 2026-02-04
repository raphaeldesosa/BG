const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, "public")));

// Serve index.html on root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ------------------- DATABASE -------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ------------------- ROUTES -------------------

// Test DB connection
app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login / register user
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );
    let user = userResult.rows[0];

    if (!user) {
      const insertResult = await pool.query(
        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
        [email, password]
      );
      user = insertResult.rows[0];
    } else if (user.password !== password) {
      return res.status(401).json({ error: "Wrong password" });
    }

    res.json({ userId: user.id, isAdmin: user.is_admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add client
app.post("/client", async (req, res) => {
  const { fullName, email, contactNumber, dsjNumber } = req.body;
  if (!fullName || !email || !contactNumber || !dsjNumber) {
    return res.status(400).json({ error: "All client fields required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO clients (full_name, email, contact_number, dsj_number)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [fullName, email, contactNumber, dsjNumber]
    );
    res.json({ client: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Borrow money
app.post("/borrow", async (req, res) => {
  const { userId, clientId, amount, note } = req.body;
  if (!userId || !clientId || !amount) {
    return res.status(400).json({ error: "User, client, and amount required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO transactions (user_id, client_id, amount, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, clientId, amount, note]
    );
    res.json({ transaction: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all clients (admin only)
app.get("/clients", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients ORDER BY created_at DESC");
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
