/*********************************
 * PAGE ELEMENTS
 *********************************/
const landingPage = document.getElementById("landing-page");
const memberPage = document.getElementById("member-page");
const adminLoginPage = document.getElementById("admin-page");
const adminViewPage = document.getElementById("admin-view");

/*********************************
 * PAGE SWITCHER (SAFE)
 *********************************/
function showPage(page) {
  [landingPage, memberPage, adminLoginPage, adminViewPage].forEach(p => {
    if (p) p.style.display = "none";
  });
  if (page) page.style.display = "block";
}

/*********************************
 * LANDING BUTTONS
 *********************************/
document.getElementById("member-btn").onclick = () =>
  showPage(memberPage);

document.getElementById("admin-btn").onclick = () =>
  showPage(adminLoginPage);

/*********************************
 * BACK BUTTONS
 *********************************/
document.getElementById("member-back-btn").onclick = () =>
  showPage(landingPage);

document.getElementById("admin-back-btn").onclick = () =>
  showPage(landingPage);

/*********************************
 * MEMBER REGISTRATION
 *********************************/
document.getElementById("submit-member").onclick = async () => {
  const data = {
    name: document.getElementById("fullName").value.trim(),
    contact: document.getElementById("contactNumber").value.trim(),
    email: document.getElementById("email").value.trim(),
    dsj_account: document.getElementById("dsjNumber").value.trim()
  };

  if (!data.name || !data.contact || !data.dsj_account) {
    document.getElementById("member-msg").textContent =
      "Please fill in all required fields.";
    return;
  }

  const res = await fetch("/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const msg = document.getElementById("member-msg");

  if (res.ok) {
    msg.textContent = "Registration successful!";
    msg.style.color = "green";
    showPage(landingPage);
  } else {
    const err = await res.json();
    msg.textContent = err.error || "Registration failed.";
    msg.style.color = "red";
  }
};

/*********************************
 * ADMIN LOGIN
 *********************************/
document.getElementById("admin-login").onclick = async () => {
  const username = document.getElementById("admin-username").value;
  const password = document.getElementById("admin-password").value;

  const res = await fetch("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const msg = document.getElementById("admin-msg");

  if (res.ok) {
    msg.textContent = "";
    showPage(adminViewPage);
    loadMembers();
  } else {
    msg.textContent = "Invalid admin credentials.";
  }
};

/*********************************
 * LOAD MEMBERS
 *********************************/
async function loadMembers() {
  const list = document.getElementById("clients-list");
  const total = document.getElementById("total-count");

  list.innerHTML = "";

  const res = await fetch("/clients");
  const members = await res.json();

  total.textContent = `Total Members: ${members.length}`;

  members.forEach(member => {
    const li = document.createElement("li");
    li.className = "member-card";

    li.innerHTML = `
      <div class="member-info">
        <div class="member-name">${member.name}</div>
        <div class="member-meta">DSJ: ${member.dsj_account}</div>
        <div class="member-meta">Contact: ${member.contact}</div>
      </div>
      <button class="delete-btn" title="Delete">🗑️</button>
    `;

    li.querySelector(".delete-btn").onclick = () =>
      requestDelete(member.id, li, member);

    list.appendChild(li);
  });
}

/*********************************
 * DELETE + UNDO
 *********************************/
let deleteTarget = null;
let deletedCache = null;
let undoTimer = null;

const modal = document.getElementById("delete-modal");
const confirmBtn = document.getElementById("confirm-delete");
const cancelBtn = document.getElementById("cancel-delete");
const toast = document.getElementById("undo-toast");
const undoBtn = document.getElementById("undo-btn");

function requestDelete(id, card, member) {
  deleteTarget = { id, card };
  deletedCache = member;
  modal.classList.remove("hidden");
}

cancelBtn.onclick = () => {
  modal.classList.add("hidden");
};

confirmBtn.onclick = async () => {
  modal.classList.add("hidden");
  deleteTarget.card.remove();

  toast.classList.remove("hidden");

  undoTimer = setTimeout(async () => {
    await fetch(`/clients/${deleteTarget.id}`, { method: "DELETE" });
    deletedCache = null;
    loadMembers();
  }, 5000);
};

undoBtn.onclick = async () => {
  clearTimeout(undoTimer);
  toast.classList.add("hidden");

  await fetch("/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(deletedCache)
  });

  loadMembers();
};

/*********************************
 * INIT
 *********************************/
showPage(landingPage);