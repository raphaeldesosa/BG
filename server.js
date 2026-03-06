const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const MAX_PROOF_IMAGE_SIZE = 2 * 1024 * 1024;
const allowedMimeTypes = ["image/jpeg", "image/png"];

const DSJ_ACCOUNT_LENGTH = 12;
const WALLET_ADDRESS_LENGTH = 42;

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
    await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS activation_proof_image BYTEA");
    await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS activation_proof_mime TEXT");
    await pool.query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS team_leader TEXT");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS clients_wallet_address_key ON clients(wallet_address)");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS clients_dsj_number_key ON clients(dsj_number)");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS clients_wallet_address_normalized_key ON clients (LOWER(TRIM(wallet_address)))");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS clients_email_normalized_key ON clients (LOWER(TRIM(email)))");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS clients_contact_number_normalized_key ON clients (BTRIM(contact_number)) WHERE contact_number IS NOT NULL AND BTRIM(contact_number) <> ''");
  } catch (err) {
    console.error("Database initialization warning:", err.message);
  }
}

// ------------------- ADMIN AUTH -------------------
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "adminpass0205";
const ADMIN_SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const adminSessions = new Map();

// ------------------- TEAM LEADER AUTH -------------------
// Replace these credentials with your own values.
const TEAM_LEADERS = [
  { username: "leader1", password: "tlpw0126", teamLeaderName: "Jerwin Evangelista" },
  { username: "leader2", password: "tlpw0226", teamLeaderName: "Jose Lim" },
  { username: "leader3", password: "tlpw0326", teamLeaderName: "Jundan Favores" },
  { username: "leader4", password: "tlpw0426", teamLeaderName: "Liza Ilagan" },
  { username: "leader5", password: "tlpw0526", teamLeaderName: "Kyla Ilagan" },
  { username: "leader6", password: "tlpw0626", teamLeaderName: "Eleanor Macaballug" },
  { username: "leader7", password: "tlpw0726", teamLeaderName: "Miguel Valdez" },
  { username: "leader8", password: "tlpw0826", teamLeaderName: "Gloria Reyes" }
];
const TEAM_LEADER_SESSION_TTL_MS = Number(process.env.TEAM_LEADER_SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const teamLeaderSessions = new Map();

function normalizeTeamLeaderName(value) {
  return (value || "").trim().toUpperCase();
}

const VALID_TEAM_LEADER_NAMES = new Set(
  TEAM_LEADERS.map(leader => normalizeTeamLeaderName(leader.teamLeaderName))
);


function createAdminSession() {
  const token = crypto.randomUUID();
  adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
  return token;
}

function isValidAdminToken(token) {
  if (!token) return false;

  const expiresAt = adminSessions.get(token);
  if (!expiresAt) return false;

  if (Date.now() > expiresAt) {
    adminSessions.delete(token);
    return false;
  }

  return true;
}

function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!isValidAdminToken(token)) return res.status(403).json({ error: "Unauthorized" });
  next();
}
function createTeamLeaderSession(teamLeaderName) {
  const token = crypto.randomUUID();
  teamLeaderSessions.set(token, {
    teamLeaderName,
    expiresAt: Date.now() + TEAM_LEADER_SESSION_TTL_MS
  });
  return token;
}

function getValidTeamLeaderSession(token) {
  if (!token) return null;

  const session = teamLeaderSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    teamLeaderSessions.delete(token);
    return null;
  }

  return session;
}

function requireTeamLeader(req, res, next) {
  const token = req.headers["x-team-leader-token"];
  const session = getValidTeamLeaderSession(token);

  if (!session) return res.status(403).json({ error: "Unauthorized" });

  req.teamLeader = session;
  next();
}

function canViewClientProof(req, clientTeamLeader) {
  const adminToken = req.headers["x-admin-token"];
  if (isValidAdminToken(adminToken)) return true;

  const teamLeaderToken = req.headers["x-team-leader-token"];
  const teamLeaderSession = getValidTeamLeaderSession(teamLeaderToken);
  if (!teamLeaderSession) return false;

  return teamLeaderSession.teamLeaderName === clientTeamLeader;
}


// ------------------- API ROUTES -------------------
app.get("/team-leaders", (_req, res) => {
  res.json({ teamLeaders: TEAM_LEADERS.map(leader => normalizeTeamLeaderName(leader.teamLeaderName)) });
});

// Add member
app.post("/client", async (req, res) => {
  const { firstName, lastName, email, contactNumber, dsjNumber, walletAddress, teamLeader, proofImageData, proofImageType } = req.body;
  const normalizedFirstName = (firstName || "").trim().toUpperCase();
  const normalizedLastName = (lastName || "").trim().toUpperCase();
  const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();
  const normalizedEmail = (email || "").trim().toLowerCase();
  const normalizedContactNumber = (contactNumber || "").trim();
  const normalizedDsjNumber = (dsjNumber || "").trim();
  const normalizedWalletAddress = (walletAddress || "").trim();
  const normalizedTeamLeader = normalizeTeamLeaderName(teamLeader);

  if (!normalizedFirstName || !normalizedLastName || !normalizedEmail || !normalizedContactNumber || !normalizedDsjNumber || !normalizedWalletAddress || !normalizedTeamLeader || !proofImageData || !proofImageType) {
    return res.status(400).json({ error: "All fields required" });
  }

  if (!VALID_TEAM_LEADER_NAMES.has(normalizedTeamLeader)) {
    return res.status(400).json({ error: "Please select a valid team leader." });
  }

  if (normalizedDsjNumber.length !== DSJ_ACCOUNT_LENGTH) {
    return res.status(400).json({ error: `DSJ account number must be exactly ${DSJ_ACCOUNT_LENGTH} characters.` });
  }

  if (normalizedWalletAddress.length !== WALLET_ADDRESS_LENGTH) {
    return res.status(400).json({ error: `Wallet address must be exactly ${WALLET_ADDRESS_LENGTH} characters.` });
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
       (full_name, email, contact_number, dsj_number, wallet_address, team_leader, proof_image, proof_mime, borrow_amount, borrow_date, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, full_name, email, contact_number, dsj_number, wallet_address, team_leader, borrow_amount, borrow_date, due_date, created_at`,
      [
        fullName,
        normalizedEmail,
        normalizedContactNumber,
        normalizedDsjNumber,
        normalizedWalletAddress,
        normalizedTeamLeader,
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
      if ((err.constraint && err.constraint.includes("email")) || (err.detail && err.detail.includes("email"))) {
        return res.status(400).json({ error: "This email address is already registered." });
      }
      if ((err.constraint && err.constraint.includes("contact")) || (err.detail && err.detail.includes("contact_number"))) {
        return res.status(400).json({ error: "This contact number is already registered." });
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
    const token = createAdminSession();
    return res.json({ token });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

// Team leader login
app.post("/team-leader/login", (req, res) => {
  const username = (req.body?.username || "").trim();
  const password = (req.body?.password || "").trim();

  const matchedLeader = TEAM_LEADERS.find(leader => leader.username === username && leader.password === password);

  if (!matchedLeader) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const teamLeaderName = normalizeTeamLeaderName(matchedLeader.teamLeaderName);
  const token = createTeamLeaderSession(teamLeaderName);
  return res.json({ token, teamLeaderName });
});

// Get clients (admin only, optional team leader filter)
app.get("/clients", requireAdmin, async (req, res) => {
  const teamLeaderFilter = normalizeTeamLeaderName(req.query.teamLeader);
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, contact_number, dsj_number, wallet_address, team_leader, borrow_amount, borrow_date, due_date,
      created_at, is_activated, activated_at,
      (proof_image IS NOT NULL AND proof_mime IS NOT NULL) AS has_proof,
      (activation_proof_image IS NOT NULL AND activation_proof_mime IS NOT NULL) AS has_activation_proof
      FROM clients
      WHERE (is_archived = FALSE OR is_archived IS NULL)
        AND ($1 = '' OR team_leader = $1)
      ORDER BY team_leader ASC, created_at DESC`,
      [teamLeaderFilter]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Team leader specific clients
app.get("/team-leader/clients", requireTeamLeader, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, contact_number, dsj_number, wallet_address, team_leader, borrow_amount, borrow_date, due_date,
       created_at, is_activated, activated_at,
       (proof_image IS NOT NULL AND proof_mime IS NOT NULL) AS has_proof,
       (activation_proof_image IS NOT NULL AND activation_proof_mime IS NOT NULL) AS has_activation_proof
       FROM clients
       WHERE (is_archived = FALSE OR is_archived IS NULL)
         AND team_leader = $1
       ORDER BY created_at DESC`,
      [req.teamLeader.teamLeaderName]
    );

    res.json({ teamLeaderName: req.teamLeader.teamLeaderName, clients: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});



// Get activated clients only (admin only)
app.get("/clients/activated", requireAdmin, async (req, res) => {
  const teamLeaderFilter = normalizeTeamLeaderName(req.query.teamLeader);

  try {
    const result = await pool.query(
       `SELECT id, full_name, email, contact_number, dsj_number, wallet_address, team_leader, borrow_amount, borrow_date, due_date,
       created_at, is_activated, activated_at,
       (proof_image IS NOT NULL AND proof_mime IS NOT NULL) AS has_proof,
       (activation_proof_image IS NOT NULL AND activation_proof_mime IS NOT NULL) AS has_activation_proof
       FROM clients
       WHERE (is_archived = FALSE OR is_archived IS NULL)
         AND is_activated = TRUE
         AND ($1 = '' OR team_leader = $1)
       ORDER BY team_leader ASC, activated_at DESC NULLS LAST, created_at DESC`
       ,
      [teamLeaderFilter]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get archived clients (admin only)
app.get("/clients/history", requireAdmin, async (req, res) => {

  try {
     const result = await pool.query(
      `SELECT id, full_name, email, contact_number, dsj_number, wallet_address, team_leader, borrow_amount, borrow_date, due_date,
       created_at, archived_at, is_activated, activated_at,
       (proof_image IS NOT NULL AND proof_mime IS NOT NULL) AS has_proof,
       (activation_proof_image IS NOT NULL AND activation_proof_mime IS NOT NULL) AS has_activation_proof
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


// Get client proof image (admin or assigned team leader)
app.get("/client/:id/proof", async (req, res) => {

  try {
    const result = await pool.query(
      `SELECT id, full_name, team_leader, proof_mime, encode(proof_image, 'base64') AS proof_image_data
       FROM clients
       WHERE id = $1`,
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Client not found" });
    }

    const client = result.rows[0];
    if (!canViewClientProof(req, client.team_leader)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    if (!client.proof_mime || !client.proof_image_data) {
      return res.status(404).json({ error: "Proof image not found" });
    }

    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get client activation proof image (admin or assigned team leader)
app.get("/client/:id/activation-proof", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, team_leader, activation_proof_mime,
              encode(activation_proof_image, 'base64') AS proof_image_data
       FROM clients
       WHERE id = $1`,
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Client not found" });
    }

    const client = result.rows[0];
    if (!canViewClientProof(req, client.team_leader)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!client.activation_proof_mime || !client.proof_image_data) {
      return res.status(404).json({ error: "Activation proof image not found" });
    }

    res.json({
      id: client.id,
      full_name: client.full_name,
      proof_mime: client.activation_proof_mime,
      proof_image_data: client.proof_image_data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Move member to history (admin only)
app.patch("/client/:id/archive", requireAdmin, async (req, res) => {
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
app.delete("/client/:id", requireAdmin, async (req, res) => {

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
app.patch("/client/:id/loan", requireAdmin, async (req, res) => {

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

// Activate member loan (team leader only with activation proof)
app.patch("/team-leader/client/:id/activate", requireTeamLeader, async (req, res) => {
  const { proofImageData, proofImageType } = req.body || {};

  if (!proofImageData || !proofImageType) {
    return res.status(400).json({ error: "Activation proof image is required." });
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

  const borrowDate = new Date();
  const dueDate = new Date(borrowDate);
  dueDate.setMonth(dueDate.getMonth() + 2);

  try {
    const result = await pool.query(
      `UPDATE clients
       SET is_activated = TRUE,
           activated_at = COALESCE(activated_at, $1),
           borrow_date = COALESCE(borrow_date, $1),
           due_date = COALESCE(due_date, $2),
           activation_proof_image = $3,
           activation_proof_mime = $4
       WHERE id = $5
         AND team_leader = $6
         AND (is_archived = FALSE OR is_archived IS NULL)
       RETURNING id, is_activated, activated_at, borrow_date, due_date`,
      [borrowDate, dueDate, proofImageBuffer, proofImageType, req.params.id, req.teamLeader.teamLeaderName]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Client not found under your group." });
    }

    res.json({ client: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Admin activation disabled: activation must be done by team leader with proof
app.patch("/client/:id/activate", requireAdmin, async (_req, res) => {
  return res.status(403).json({ error: "Only team leaders can activate loans with proof upload." });
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