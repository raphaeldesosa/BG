/*********************************
 * PAGE NAVIGATION
 *********************************/
const landingPage = document.getElementById("landing-page");
const memberPage = document.getElementById("member-page");
const adminLoginPage = document.getElementById("admin-login-page");
const adminPage = document.getElementById("admin-page");

function showPage(page) {
  [landingPage, memberPage, adminLoginPage, adminPage].forEach(p => {
    if (p) p.style.display = "none";
  });
  page.style.display = "block";
}

/*********************************
 * LANDING BUTTONS
 *********************************/
document.getElementById("member-btn")?.addEventListener("click", () => {
  showPage(memberPage);
});

document.getElementById("admin-btn")?.addEventListener("click", () => {
  showPage(adminLoginPage);
});

/*********************************
 * MEMBER REGISTRATION
 *********************************/
document.getElementById("member-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    name: document.getElementById("name").value,
    contact: document.getElementById("contact").value,
    email: document.getElementById("email").value,
    dsj_account: document.getElementById("dsj_account").value
  };

  const res = await fetch("/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    alert("Registration successful! Due date is 2 months from today.");
    e.target.reset();
    showPage(landingPage);
  } else {
    const err = await res.json();
    alert(err.error || "Registration failed");
  }
});

/*********************************
 * ADMIN LOGIN
 *********************************/
document.getElementById("admin-login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("admin-username").value;
  const password = document.getElementById("admin-password").value;

  const res = await fetch("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    showPage(adminPage);
    loadMembers();
  } else {
    alert("Invalid admin credentials");
  }
});

/*********************************
 * LOAD MEMBERS (ADMIN)
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

    const dueDate = new Date(member.due_date);
    const today = new Date();
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    const dueSoon = diffDays <= 7;

    li.innerHTML = `
      <div class="member-info">
        <div class="member-name">${member.name}</div>
        <div class="member-meta">DSJ: ${member.dsj_account}</div>
        <div class="member-meta">Contact: ${member.contact}</div>
        <div class="member-meta ${dueSoon ? "due-soon" : ""}">
          Due: ${dueDate.toLocaleDateString()}
        </div>
      </div>
      <button class="delete-btn">🗑️</button>
    `;

    li.querySelector(".delete-btn").onclick = () =>
      requestDelete(member.id, li, member);

    list.appendChild(li);
  });
}

/*********************************
 * DELETE + UNDO SYSTEM
 *********************************/
let deleteTarget = null;
let deletedCache = null;
let undoTimer = null;

const modal = document.getElementById("delete-modal");
const confirmBtn = document.getElementById("confirm-delete");
const cancelBtn = document.getElementById("cancel-delete");
const toast = document.getElementById("undo-toast");
const undoBtn = document.getElementById("undo-btn");

function requestDelete(id, cardElement, memberData) {
  deleteTarget = { id, cardElement };
  deletedCache = memberData;
  modal.classList.remove("hidden");
}

cancelBtn.onclick = () => {
  modal.classList.add("hidden");
  deleteTarget = null;
};

confirmBtn.onclick = async () => {
  modal.classList.add("hidden");

  const { id, cardElement } = deleteTarget;

  cardElement.classList.add("removing");

  setTimeout(() => {
    cardElement.remove();
    showUndoToast();
  }, 300);

  undoTimer = setTimeout(async () => {
    await fetch(`/clients/${id}`, { method: "DELETE" });
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

function showUndoToast() {
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 5000);
}

/*********************************
 * INITIAL STATE
 *********************************/
showPage(landingPage);