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
    await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE");
    await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ");
    await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_activated BOOLEAN DEFAULT FALSE");
    await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS clients_wallet_address_key ON clients(wallet_address)");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS clients_dsj_number_key ON clients(dsj_number)");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS clients_wallet_address_normalized_key ON clients (LOWER(TRIM(wallet_address)))");
  } catch (err) {
    console.error("Database initialization warning:", err.message);
  }
}

// ------------------- ADMIN TOKEN -------------------
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "supersecret123";
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "adminpass0205";

// ------------------- API ROUTES -------------------

// Add member
app.post("/client", async (req, res) => {
   const { fullName, email, contactNumber, dsjNumber, walletAddress, proofImageData, proofImageType } = req.body;
   const normalizedDsjNumber = (dsjNumber || "").trim();
   const normalizedWalletAddress = (walletAddress || "").trim();

    if (!fullName || !email || !contactNumber || !normalizedDsjNumber || !normalizedWalletAddress || !proofImageData || !proofImageType) {
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
  const borrowDate = null;
  const dueDate = null;

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
        normalizedDsjNumber,
        normalizedWalletAddress,
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
  const username = (req.body?.username || "").trim();
  const password = (req.body?.password || "").trim();

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
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
        `SELECT id, full_name, email, contact_number, dsj_number, wallet_address, borrow_amount, borrow_date, due_date,
        proof_mime, encode(proof_image, 'base64') AS proof_image_data,
        is_activated, activated_at
        FROM clients
        WHERE is_archived = FALSE OR is_archived IS NULL
        ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get archived clients (admin only)
app.get("/clients/history", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Unauthorized" });

  try {
     const result = await pool.query(
      `SELECT id, full_name, email, contact_number, dsj_number, wallet_address, borrow_amount, borrow_date, due_date,
       proof_mime, encode(proof_image, 'base64') AS proof_image_data, archived_at,
       is_activated, activated_at
       FROM clients
       WHERE is_archived = TRUE
       ORDER BY archived_at DESC NULLS LAST, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Move member to history (admin only)
app.patch("/client/:id/archive", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      "UPDATE clients SET is_archived = TRUE, archived_at = NOW() WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Permanently delete member from archived history (admin only)
app.delete("/client/:id", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      "DELETE FROM clients WHERE id = $1 AND is_archived = TRUE RETURNING id",
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Archived client not found" });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Update member loan amount (admin only)
app.patch("/client/:id/loan", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Unauthorized" });

  const amount = Number(req.body?.borrowAmount);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "Loan amount must be a valid number." });
  }

  try {
    const result = await pool.query(
      "UPDATE clients SET borrow_amount = $1 WHERE id = $2 RETURNING id, borrow_amount",
      [amount, req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Activate member loan (admin only)
app.patch("/client/:id/activate", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Unauthorized" });

  const borrowDate = new Date();
  const dueDate = new Date(borrowDate);
  dueDate.setMonth(dueDate.getMonth() + 2);

  try {
    const result = await pool.query(
      `UPDATE clients
       SET is_activated = TRUE,
           activated_at = COALESCE(activated_at, $1),
           borrow_date = COALESCE(borrow_date, $1),
           due_date = COALESCE(due_date, $2)
       WHERE id = $3
       RETURNING id, is_activated, activated_at, borrow_date, due_date`,
      [borrowDate, dueDate, req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ client: result.rows[0] });
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