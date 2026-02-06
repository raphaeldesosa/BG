const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const MAX_PROOF_IMAGE_SIZE = 2 * 1024 * 1024;
const allowedMimeTypes = ["image/jpeg", "image/png"];

// ------------------- DATABASE -------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  try {
    await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS wallet_address TEXT");
    await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS proof_image BYTEA");
    await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS proof_mime TEXT");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS clients_wallet_address_key ON clients(wallet_address)");
  } catch (err) {
    console.error("Database initialization warning:", err.message);
  }
}

// ------------------- ADMIN TOKEN -------------------
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "supersecret123";

// ------------------- API ROUTES -------------------

// Add member
app.post("/client", async (req, res) => {
   const { fullName, email, contactNumber, dsjNumber, walletAddress, proofImageData, proofImageType } = req.body;

   if (!fullName || !email || !contactNumber || !dsjNumber || !walletAddress || !proofImageData || !proofImageType) {
    return res.status(400).json({ error: "All fields required" });
  }

    if (!allowedMimeTypes.includes(proofImageType)) {
    return res.status(400).json({ error: "Only JPEG and PNG files are allowed." });
  }

  let proofImageBuffer;
  try {
    proofImageBuffer = Buffer.from(proofImageData, "base64");
  } catch (_err) {
    return res.status(400).json({ error: "Invalid image upload." });
  }

  if (!proofImageBuffer.length) {
    return res.status(400).json({ error: "Invalid image upload." });
  }

  if (proofImageBuffer.length > MAX_PROOF_IMAGE_SIZE) {
    return res.status(400).json({ error: "Image must be 2MB or smaller." });
  }

  const borrowAmount = 100;
  const borrowDate = new Date();
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 2);

  try {
    const result = await pool.query(
      `INSERT INTO clients 
       (full_name, email, contact_number, dsj_number, wallet_address, proof_image, proof_mime, borrow_amount, borrow_date, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, full_name, email, contact_number, dsj_number, wallet_address, borrow_amount, borrow_date, due_date`,
      [
        fullName,
        email,
        contactNumber,
        dsjNumber,
        walletAddress,
        proofImageBuffer,
        proofImageType,
        borrowAmount,
        borrowDate,
        dueDate
      ]      
    );
    res.json({ client: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
       if ((err.constraint && err.constraint.includes("wallet")) || (err.detail && err.detail.includes("wallet_address"))) {
        return res.status(400).json({ error: "This wallet address is already registered." });
      }
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
       "SELECT id, full_name, email, contact_number, dsj_number, wallet_address, borrow_amount, borrow_date, due_date FROM clients ORDER BY created_at DESC"
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
initDatabase().finally(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});