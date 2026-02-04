const API = "https://your-backend-name.onrender.com"; // <-- Replace with your Render backend URL

let userId = null;
let isAdmin = false;

// Login/Register
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(res.ok) {
      userId = data.userId;
      isAdmin = data.isAdmin;
      document.getElementById("login-section").style.display = "none";
      document.getElementById("client-section").style.display = "block";
      loadClients();
    } else {
      document.getElementById("login-msg").innerText = data.error;
    }
  } catch (err) {
    document.getElementById("login-msg").innerText = err.message;
  }
});

// Add client
document.getElementById("add-client-btn").addEventListener("click", async () => {
  const fullName = document.getElementById("fullName").value;
  const email = document.getElementById("clientEmail").value;
  const contactNumber = document.getElementById("contactNumber").value;
  const dsjNumber = document.getElementById("dsjNumber").value;

  try {
    const res = await fetch(`${API}/client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, contactNumber, dsjNumber })
    });
    const data = await res.json();
    if(res.ok){
      document.getElementById("client-msg").innerText = "Client added!";
      loadClients();
    } else {
      document.getElementById("client-msg").innerText = data.error;
    }
  } catch (err) {
    document.getElementById("client-msg").innerText = err.message;
  }
});

// Borrow money
document.getElementById("borrow-btn").addEventListener("click", async () => {
  const clientId = document.getElementById("client-select").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const note = document.getElementById("note").value;

  try {
    const res = await fetch(`${API}/borrow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, clientId, amount, note })
    });
    const data = await res.json();
    if(res.ok){
      document.getElementById("borrow-msg").innerText = "Transaction added!";
    } else {
      document.getElementById("borrow-msg").innerText = data.error;
    }
  } catch (err) {
    document.getElementById("borrow-msg").innerText = err.message;
  }
});

// Load clients for admin and dropdown
async function loadClients() {
  try {
    const res = await fetch(`${API}/clients`);
    const data = await res.json();
    const list = document.getElementById("clients-list");
    const select = document.getElementById("client-select");

    list.innerHTML = "";
    select.innerHTML = "";

    data.clients.forEach(client => {
      // Admin list
      const li = document.createElement("li");
      li.innerText = `${client.full_name} | ${client.dsj_number} | ${client.contact_number}`;
      if(isAdmin) list.appendChild(li);

      // Dropdown
      const option = document.createElement("option");
      option.value = client.id;
      option.innerText = client.full_name;
      select.appendChild(option);
    });
  } catch (err) {
    console.log(err);
  }
}
