const API = ""; // same origin
const ADMIN_CREDENTIALS = { username: "adminuser", password: "adminpass" };
const ADMIN_TOKEN = "supersecret123"; // must match backend

// ---------------- Page navigation ----------------
const landing = document.getElementById("landing-page");
const memberPage = document.getElementById("member-page");
const adminPage = document.getElementById("admin-page");
const adminView = document.getElementById("admin-view");

// Buttons
document.getElementById("member-btn").addEventListener("click", () => {
  landing.style.display = "none";
  memberPage.style.display = "block";
});

document.getElementById("admin-btn").addEventListener("click", () => {
  landing.style.display = "none";
  adminPage.style.display = "block";
});

document.getElementById("member-back").addEventListener("click", () => {
  memberPage.style.display = "none";
  landing.style.display = "block";
});

document.getElementById("admin-back").addEventListener("click", () => {
  adminPage.style.display = "none";
  landing.style.display = "block";
});

document.getElementById("logout-admin").addEventListener("click", () => {
  adminView.style.display = "none";
  landing.style.display = "block";
});

// ---------------- Member submission ----------------
document.getElementById("submit-member").addEventListener("click", async () => {
  const fullName = document.getElementById("fullName").value;
  const contactNumber = document.getElementById("contactNumber").value;
  const email = document.getElementById("email").value;
  const dsjNumber = document.getElementById("dsjNumber").value;

  if (!fullName || !contactNumber || !email || !dsjNumber) {
    document.getElementById("member-msg").innerText = "Please fill in all fields";
    return;
  }

  try {
    const res = await fetch(`${API}/client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, contactNumber, email, dsjNumber })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById("member-msg").innerText = `Member registered! Borrowed $100. Due: ${new Date(data.client.due_date).toLocaleDateString()}`;

      // Notify if due date is within 7 days
      const due = new Date(data.client.due_date);
      const today = new Date();
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        document.getElementById("member-msg").innerText += " ⚠ Your payment is due soon!";
      }

      // Clear form
      document.getElementById("fullName").value = "";
      document.getElementById("contactNumber").value = "";
      document.getElementById("email").value = "";
      document.getElementById("dsjNumber").value = "";
    } else {
      document.getElementById("member-msg").innerText = data.error;
    }
  } catch (err) {
    document.getElementById("member-msg").innerText = err.message;
  }
});

// ---------------- Admin login ----------------
document.getElementById("admin-login").addEventListener("click", async () => {
  const username = document.getElementById("admin-username").value;
  const password = document.getElementById("admin-password").value;

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    adminPage.style.display = "none";
    adminView.style.display = "block";
    loadClients();
  } else {
    document.getElementById("admin-msg").innerText = "Invalid credentials";
  }
});

// ---------------- Load clients (admin only) ----------------
async function loadClients() {
  try {
    const res = await fetch(`${API}/clients`, {
      headers: { "x-admin-token": ADMIN_TOKEN }
    });
    const data = await res.json();
    const list = document.getElementById("clients-list");

    list.innerHTML = "";
    data.clients.forEach(client => {
      const dueDate = new Date(client.due_date);
      const today = new Date();
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      const alertText = diffDays <= 7 ? " ⚠ Due soon!" : "";

      const li = document.createElement("li");
      li.innerText = `${client.full_name} | ${client.dsj_number} | ${client.contact_number} | ${client.email} | Borrowed $${client.borrow_amount} | Due: ${dueDate.toLocaleDateString()}${alertText}`;
      list.appendChild(li);
    });
  } catch (err) {
    console.log(err);
  }
}
