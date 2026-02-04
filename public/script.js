const API = ""; // same origin backend
const ADMIN_CREDENTIALS = { username: "adminuser", password: "adminpass" };
const ADMIN_TOKEN = "supersecret123";

// ===== PAGE REFERENCES =====
const landing = document.getElementById("landing-page");
const memberPage = document.getElementById("member-page");
const adminPage = document.getElementById("admin-page");
const adminView = document.getElementById("admin-view");

// ===== NAVIGATION =====
document.getElementById("member-btn").onclick = () => {
  landing.style.display = "none";
  memberPage.style.display = "block";
};

document.getElementById("admin-btn").onclick = () => {
  landing.style.display = "none";
  adminPage.style.display = "block";
};

document.getElementById("member-back").onclick = () => {
  memberPage.style.display = "none";
  landing.style.display = "block";
};

document.getElementById("admin-back").onclick = () => {
  adminPage.style.display = "none";
  landing.style.display = "block";
};

document.getElementById("logout-admin").onclick = () => {
  adminView.style.display = "none";
  landing.style.display = "block";
};

// ===== MEMBER SUBMIT =====
document.getElementById("submit-member").onclick = async () => {
  const fullName = fullNameInput.value = document.getElementById("fullName").value;
  const contactNumber = document.getElementById("contactNumber").value;
  const email = document.getElementById("email").value;
  const dsjNumber = document.getElementById("dsjNumber").value;

  if (!fullName || !contactNumber || !email || !dsjNumber) {
    document.getElementById("member-msg").innerText = "All fields required";
    return;
  }

  const res = await fetch(`${API}/client`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName, contactNumber, email, dsjNumber })
  });

  const data = await res.json();

  if (!res.ok) {
    document.getElementById("member-msg").innerText = data.error;
    return;
  }

  const dueDate = new Date(data.client.due_date);
  const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));

  document.getElementById("member-msg").innerText =
    `Registered successfully! Due on ${dueDate.toLocaleDateString()}` +
    (daysLeft <= 7 ? " ⚠ Payment due soon!" : "");

  ["fullName", "contactNumber", "email", "dsjNumber"].forEach(id => {
    document.getElementById(id).value = "";
  });
};

// ===== ADMIN LOGIN =====
document.getElementById("admin-login").onclick = () => {
  const u = document.getElementById("admin-username").value;
  const p = document.getElementById("admin-password").value;

  if (u === ADMIN_CREDENTIALS.username && p === ADMIN_CREDENTIALS.password) {
    adminPage.style.display = "none";
    adminView.style.display = "block";
    loadClients();
  } else {
    document.getElementById("admin-msg").innerText = "Invalid credentials";
  }
};

// ===== LOAD CLIENTS =====
async function loadClients() {
  const res = await fetch(`${API}/clients`, {
    headers: { "x-admin-token": ADMIN_TOKEN }
  });

  const data = await res.json();
  const list = document.getElementById("clients-list");
  const total = document.getElementById("total-count");

  list.innerHTML = "";

  data.clients.forEach(client => {
    const due = new Date(client.due_date);
    const daysLeft = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));

    const li = document.createElement("li");
    li.className = "member-card";

    li.innerHTML = `
      <div class="member-info">
        <span class="member-name">${client.full_name}</span>
        <span class="member-meta">DSJ: ${client.dsj_number} • ${client.contact_number} • ${client.email}</span>
        <span class="member-meta ${daysLeft <= 7 ? "due-soon" : ""}">
          Borrowed $${client.borrow_amount} — Due: ${due.toLocaleDateString()}
        </span>
      </div>
    `;

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.innerHTML = `<i class="fa-solid fa-trash"></i>`;
    del.onclick = async () => {
      if (!confirm(`Remove ${client.full_name}?`)) return;
      await fetch(`${API}/client/${client.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": ADMIN_TOKEN }
      });
      loadClients();
    };

    li.appendChild(del);
    list.appendChild(li);
  });

  total.innerText = `Total Members: ${data.clients.length}`;
}
