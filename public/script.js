/*********************************
 * SAFE PAGE SELECTORS
 *********************************/
const landingPage = document.getElementById("landing-page");
const memberPage = document.getElementById("member-page");
const adminLoginPage = document.getElementById("admin-login-page");
const adminPage = document.getElementById("admin-view");
const adminHistoryPage = document.getElementById("admin-history-page");
const maxProofSizeBytes = 2 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png"];

/*********************************
 * PAGE SWITCHER (NULL-SAFE)
 *********************************/
function showPage(page) {
  [landingPage, memberPage, adminLoginPage, adminPage, adminHistoryPage].forEach(p => {
    if (p) p.style.display = "none";
  });

  if (page) page.style.display = "block";
}


function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function buildProofImageTag(member) {
  if (!member.proof_image_data || !member.proof_mime) {
    return '<div class="member-meta">Proof: Not uploaded</div>';
  }

  return `
    <div class="member-meta">Proof:</div>
    <img class="proof-image" src="data:${member.proof_mime};base64,${member.proof_image_data}" alt="Proof uploaded by ${member.full_name}">
  `;
}

document.getElementById("member-btn")?.addEventListener("click", () => {
  showPage(memberPage);
});

document.getElementById("admin-btn")?.addEventListener("click", () => {
  showPage(adminLoginPage);
});


document.getElementById("member-back-btn")?.addEventListener("click", () => {
  showPage(landingPage);
});


document.getElementById("admin-back-btn")?.addEventListener("click", () => {
  showPage(landingPage);
});


document.getElementById("admin-dashboard-back-btn")?.addEventListener("click", () => {
  showPage(landingPage);
});

document.getElementById("view-history-btn")?.addEventListener("click", async () => {
  showPage(adminHistoryPage);
  await loadHistory();
});

document.getElementById("history-back-btn")?.addEventListener("click", async () => {
  showPage(adminPage);
  await loadMembers();
});

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


let ADMIN_TOKEN = null;

document.getElementById("admin-login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value.trim();
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
    return;
  }

  if (res.status === 401) {
    msg.textContent = "Invalid admin credentials";
    return;
  }

  const err = await res.json().catch(() => ({ error: "Unable to login right now." }));
  msg.textContent = err.error || "Unable to login right now.";
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
        <div class="member-meta">DSJ Account No: ${member.dsj_number}</div>
        <div class="member-meta">Wallet Address: ${member.wallet_address || "-"}</div>
        <div class="member-meta">Contact: ${member.contact_number}</div>
        <div class="member-meta">Loaned Amount: ₱${Number(member.borrow_amount || 0).toLocaleString()}</div>
        <div class="member-meta ${dueSoon ? "due-soon" : ""}">
          Due: ${formatDate(member.due_date)}
        </div>
        ${buildProofImageTag(member)}
      </div>
       <div class="member-actions">
        <button class="edit-loan-btn" title="Edit loan amount">Edit Loan</button>
        <button class="delete-btn" title="Move to history">Archive</button>
      </div>
    `;

    li.querySelector(".delete-btn").onclick = () => requestArchive(member.id, li);
    li.querySelector(".edit-loan-btn").onclick = async () => {
      const currentAmount = Number(member.borrow_amount || 0);
      const input = prompt(`Enter new loan amount for ${member.full_name}:`, String(currentAmount));
      if (input === null) return;

      const nextAmount = Number(input.trim());
      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        alert("Please enter a valid loan amount.");
        return;
      }

      const updateRes = await fetch(`/client/${member.id}/loan`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": ADMIN_TOKEN
        },
        body: JSON.stringify({ borrowAmount: nextAmount })
      });

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({ error: "Failed to update loan amount." }));
        alert(err.error || "Failed to update loan amount.");
        return;
      }

      await loadMembers();
    };

    list.appendChild(li);
  });
}

async function loadHistory() {
  const list = document.getElementById("history-list");
  const total = document.getElementById("history-count");

  if (!list || !total || !ADMIN_TOKEN) return;

  list.innerHTML = "";

  const res = await fetch("/clients/history", {
    headers: { "x-admin-token": ADMIN_TOKEN }
  });

  if (!res.ok) {
    list.innerHTML = "<li>Failed to load history.</li>";
    total.textContent = "Archived Members: 0";
    return;
  }

  const members = await res.json();
  total.textContent = `Archived Members: ${members.length}`;

  members.forEach(member => {
    const li = document.createElement("li");
    li.className = "member-card";

    li.innerHTML = `
      <div class="member-info">
        <div class="member-name">${member.full_name}</div>
        <div class="member-meta">DSJ: ${member.dsj_number}</div>
        <div class="member-meta">Wallet: ${member.wallet_address || "-"}</div>
        <div class="member-meta">Archived: ${formatDate(member.archived_at)}</div>
        ${buildProofImageTag(member)}
      </div>
    `;

    list.appendChild(li);
  });
}

let archiveTarget = null;

const modal = document.getElementById("delete-modal");
const confirmBtn = document.getElementById("confirm-delete");
const cancelBtn = document.getElementById("cancel-delete");


modal.classList.add("hidden");

function requestArchive(id, card) {
  archiveTarget = { id, card };
  modal.classList.remove("hidden");
}

cancelBtn?.addEventListener("click", () => {
  modal.classList.add("hidden");
  archiveTarget = null;
});

confirmBtn?.addEventListener("click", async () => {
  if (!archiveTarget || !ADMIN_TOKEN) return;

  const target = archiveTarget;
  archiveTarget = null;
  modal.classList.add("hidden");
  

  const res = await fetch(`/client/${target.id}/archive`, {
    method: "PATCH",
    headers: { "x-admin-token": ADMIN_TOKEN }
  });

  if (!res.ok) {
    alert("Failed to move member to history.");
    return;
  }

  target.card.remove();

  loadMembers();
});

showPage(landingPage);