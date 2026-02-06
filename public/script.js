/*********************************
 * SAFE PAGE SELECTORS
 *********************************/
const landingPage = document.getElementById("landing-page");
const memberPage = document.getElementById("member-page");
const adminLoginPage = document.getElementById("admin-login-page");
const adminPage = document.getElementById("admin-view"); // match HTML ID
const maxProofSizeBytes = 2 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png"];

/*********************************
 * PAGE SWITCHER (NULL-SAFE)
 *********************************/
function showPage(page) {
  [landingPage, memberPage, adminLoginPage, adminPage].forEach(p => {
    if (p) p.style.display = "none";
  });

  if (page) page.style.display = "block";
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
 * BACK BUTTONS
 *********************************/
document.getElementById("member-back-btn")?.addEventListener("click", () => {
  showPage(landingPage);
});

// BACK BUTTON (ADMIN LOGIN)
document.getElementById("admin-back-btn")?.addEventListener("click", () => {
  showPage(landingPage);
});

// BACK BUTTON (ADMIN DASHBOARD)
document.getElementById("admin-dashboard-back-btn")?.addEventListener("click", () => {
  showPage(landingPage);
});

/*********************************
 * MEMBER REGISTRATION
 *********************************/
document.getElementById("member-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

   const proofImage = document.getElementById("proof_image").files[0];

  if (!proofImage) {
    alert("Please upload a proof image.");
    return;
  }

  if (!allowedImageTypes.includes(proofImage.type)) {
    alert("Only JPEG and PNG files are allowed.");
    return;
  }

  if (proofImage.size > maxProofSizeBytes) {
    alert("Proof image must be 2MB or smaller.");
    return;
  }

  const proofImageData = await proofImage.arrayBuffer();
  const bytes = new Uint8Array(proofImageData);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64Proof = btoa(binary);


  const data = {
    fullName: document.getElementById("name").value,
    contactNumber: document.getElementById("contact").value,
    email: document.getElementById("email").value,
    dsjNumber: document.getElementById("dsj_account").value,
    walletAddress: document.getElementById("wallet_address").value,
    proofImageData: base64Proof,
    proofImageType: proofImage.type
  };

  const res = await fetch("/client", {
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
let ADMIN_TOKEN = null;

document.getElementById("admin-login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("admin-username").value;
  const password = document.getElementById("admin-password").value;
  const msg = document.getElementById("admin-msg");

  const res = await fetch("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    const data = await res.json();
    ADMIN_TOKEN = data.token;
    msg.textContent = "";
    showPage(adminPage);
    loadMembers();
  } else {
    msg.textContent = "Invalid admin credentials";
  }
});

/*********************************
 * LOAD MEMBERS (ADMIN)
 *********************************/
async function loadMembers() {
  const list = document.getElementById("clients-list");
  const total = document.getElementById("total-count");

  if (!list || !total || !ADMIN_TOKEN) return;

  list.innerHTML = "";

  const res = await fetch("/clients", {
    headers: { "x-admin-token": ADMIN_TOKEN }
  });

  if (!res.ok) {
    list.innerHTML = "<li>Failed to load members.</li>";
    total.textContent = "Total Members: 0";
    return;
  }

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
        <div class="member-name">${member.full_name}</div>
        <div class="member-meta">DSJ: ${member.dsj_number}</div>
        <div class="member-meta">Wallet: ${member.wallet_address || "-"}</div>
        <div class="member-meta">Contact: ${member.contact_number}</div>
        <div class="member-meta ${dueSoon ? "due-soon" : ""}">
          Due: ${dueDate.toLocaleDateString()}
        </div>
      </div>
      <button class="delete-btn">🗑️</button>
    `;

    li.querySelector(".delete-btn").onclick = () => requestDelete(member.id, li, member);
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

// Hide modal/toast initially
modal.classList.add("hidden");
toast.classList.add("hidden");

function requestDelete(id, card, member) {
  deleteTarget = { id, card };
  deletedCache = member;
  modal.classList.remove("hidden");
}

cancelBtn?.addEventListener("click", () => {
  modal.classList.add("hidden");
  deleteTarget = null;
});

confirmBtn?.addEventListener("click", async () => {
  modal.classList.add("hidden");

  deleteTarget.card.remove();
  toast.classList.remove("hidden");

  undoTimer = setTimeout(async () => {
    await fetch(`/client/${deleteTarget.id}`, {
      method: "DELETE",
      headers: { "x-admin-token": ADMIN_TOKEN }
    });
    deletedCache = null;
    loadMembers();
    toast.classList.add("hidden");
  }, 5000);
});

undoBtn?.addEventListener("click", async () => {
  clearTimeout(undoTimer);
  toast.classList.add("hidden");

  await fetch("/client", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": ADMIN_TOKEN
    },
    body: JSON.stringify(deletedCache)
  });

  loadMembers();
});

/*********************************
 * INITIAL LOAD
 *********************************/
showPage(landingPage);