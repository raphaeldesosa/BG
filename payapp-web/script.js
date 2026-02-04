const API = "http://localhost:3000";

let userId = null;
let clientId = null;

/* LOGIN */
async function login() {
  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.value,
      password: password.value
    })
  });

  const data = await res.json();

  if (data.error) {
    alert(data.error);
    return;
  }

  userId = data.userId;
  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

/* SAVE CLIENT */
async function saveClient() {
  const res = await fetch(`${API}/client`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: fullName.value,
      email: clientEmail.value,
      contactNumber: contactNumber.value,
      dsjNumber: dsjNumber.value
    })
  });

  const data = await res.json();
  clientId = data.id;

  document.getElementById("clientStatus").innerText =
    `Client saved (ID: ${clientId})`;
}

/* BORROW MONEY */
async function borrow() {
  if (!clientId) {
    alert("Save client first");
    return;
  }

  await fetch(`${API}/borrow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      clientId,
      amount: amount.value,
      note: note.value
    })
  });

  alert("Borrow transaction saved");
}

/* ADMIN VIEW */
async function loadBorrowers() {
  const res = await fetch(`${API}/admin/clients`);
  const data = await res.json();

  const list = document.getElementById("adminList");
  list.innerHTML = "";

  data.forEach(row => {
    const li = document.createElement("li");
    li.textContent =
      `${row.full_name} | DSJ: ${row.dsj_number} | Amount: ₱${row.amount || 0}`;
    list.appendChild(li);
  });
}

/* LOGOUT */
function logout() {
  location.reload();
}

// Verify backend

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

