/*********************************
 * SAFE PAGE SELECTORS
 *********************************/
const landingPage = document.getElementById("landing-page");
const memberPage = document.getElementById("member-page");
const adminLoginPage = document.getElementById("admin-login-page");
const teamLeaderLoginPage = document.getElementById("team-leader-login-page");
const adminPage = document.getElementById("admin-view");
const teamLeaderPage = document.getElementById("team-leader-view");
const adminHistoryPage = document.getElementById("admin-history-page");
const adminActivatedPage = document.getElementById("admin-activated-page");

const maxProofSizeBytes = 2 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png"];
const ADMIN_TOKEN_STORAGE_KEY = "admin_token";
const TEAM_LEADER_TOKEN_STORAGE_KEY = "team_leader_token";
const TEAM_LEADER_NAME_STORAGE_KEY = "team_leader_name";

let ADMIN_TOKEN = null;
let TEAM_LEADER_TOKEN = null;
let TEAM_LEADER_NAME = null;
let selectedAdminFilter = "";
let teamLeadersCache = [];

/*********************************
 * PAGE SWITCHER (NULL-SAFE)
 *********************************/
function showPage(page) {
   [landingPage, memberPage, adminLoginPage, teamLeaderLoginPage, adminPage, teamLeaderPage, adminHistoryPage, adminActivatedPage].forEach(p => {
    if (p) p.style.display = "none";
  });

  if (page) page.style.display = "block";
}


function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function getActivationLabel(member) {
  return member.is_activated ? "Activated" : "Pending";
}

function buildActivationMeta(member) {
  
  if (!member.is_activated) return '<div class="member-meta">Status: Pending activation</div>';

  return `
    <div class="member-meta">Status: Activated</div>
    <div class="member-meta">Activated: ${formatDate(member.activated_at)}</div>
  `;
}

function buildProofSection(member) {
  if (!member.has_proof) return '<div class="member-meta">Proof: Not uploaded</div>';

  return `
    <div class="member-meta">Proof: <button class="proof-toggle-btn" type="button">View Proof</button></div>
    <div class="proof-container"></div>
  `;
}

async function toggleProofImage(button, container, member, mode = "admin") {
  if (!button || !container) return;

  const isVisible = container.dataset.visible === "true";
  if (isVisible) {
    container.innerHTML = "";
    container.dataset.visible = "false";
    button.textContent = "View Proof";
    return;
  }

  if (!container.dataset.loaded) {
    button.disabled = true;
    button.textContent = "Loading...";

     const headers = {};
    if (mode === "teamLeader") {
      headers["x-team-leader-token"] = TEAM_LEADER_TOKEN;
    } else {
      headers["x-admin-token"] = ADMIN_TOKEN;
    }

    const res = await fetch(`/client/${member.id}/proof`, { headers });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to load proof image." }));
      alert(err.error || "Failed to load proof image.");
      button.disabled = false;
      button.textContent = "View Proof";
      return;
    }

    const proof = await res.json();
    container.innerHTML = `<img class="proof-image" src="data:${proof.proof_mime};base64,${proof.proof_image_data}" alt="Proof uploaded by ${member.full_name}">`;
    container.dataset.loaded = "true";
    button.disabled = false;
  }

  container.dataset.visible = "true";
  button.textContent = "Hide Proof";
}


function saveAdminToken(token) {
  ADMIN_TOKEN = token;

  if (token) {
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    return;
  }

  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

function saveTeamLeaderSession(token, name) {
  TEAM_LEADER_TOKEN = token;
  TEAM_LEADER_NAME = name;

  if (token) {
    localStorage.setItem(TEAM_LEADER_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TEAM_LEADER_NAME_STORAGE_KEY, name || "");
    return;
  }

  localStorage.removeItem(TEAM_LEADER_TOKEN_STORAGE_KEY);
  localStorage.removeItem(TEAM_LEADER_NAME_STORAGE_KEY);
}

async function fetchTeamLeaders() {
  const res = await fetch("/team-leaders");
  if (!res.ok) {
    teamLeadersCache = [];
    return;
  }
   const data = await res.json();
  teamLeadersCache = Array.isArray(data.teamLeaders) ? data.teamLeaders : [];
}

function renderTeamLeaderFilters() {
  const container = document.getElementById("team-leader-filters");
  if (!container) return;

  container.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.className = `secondary-btn filter-btn ${selectedAdminFilter === "" ? "active-filter" : ""}`;
  allBtn.textContent = "All Team Leaders";
  allBtn.onclick = async () => {
    selectedAdminFilter = "";
    renderTeamLeaderFilters();
    await loadMembers();
  };
  container.appendChild(allBtn);

  teamLeadersCache.forEach(name => {
    const btn = document.createElement("button");
    btn.className = `secondary-btn filter-btn ${selectedAdminFilter === name ? "active-filter" : ""}`;
    btn.textContent = name;
    btn.onclick = async () => {
      selectedAdminFilter = name;
      renderTeamLeaderFilters();
      await loadMembers();
    };
    container.appendChild(btn);
  });
}

/*********************************
 * LOAD MEMBERS (ADMIN)
 *********************************/
async function loadMembers() {
  const list = document.getElementById("clients-list");
  const total = document.getElementById("total-count");

  if (!list || !total || !ADMIN_TOKEN) return;

  list.innerHTML = "";
  const query = selectedAdminFilter ? `?teamLeader=${encodeURIComponent(selectedAdminFilter)}` : "";

  const res = await fetch(`/clients${query}`, {
    headers: { "x-admin-token": ADMIN_TOKEN }
  });

  if (!res.ok) {
    list.innerHTML = "<li>Failed to load members.</li>";
    total.textContent = "Pending Members: 0";
    return;
  }

  const members = await res.json();
  const pendingMembers = members.filter(member => !member.is_activated);
  total.textContent = `Pending Members: ${pendingMembers.length}`;
   
  if (!pendingMembers.length) {
    list.innerHTML = "<li>No pending members.</li>";
    return;
  }

  pendingMembers.forEach(member => {
    const li = document.createElement("li");
    li.className = "member-card";


    li.innerHTML = `
      <div class="member-info">
        <div class="member-name">${member.full_name}</div>
        <div class="member-meta">Team Leader: ${member.team_leader || "-"}</div>
        <div class="member-meta">Registered: ${formatDate(member.created_at)}</div>
        <div class="member-meta">DSJ Account No: ${member.dsj_number}</div>
        <div class="member-meta">Wallet Address: ${member.wallet_address || "-"}</div>
        <div class="member-meta">Contact: ${member.contact_number}</div>
        <div class="member-meta">Loaned Amount: ₱${Number(member.borrow_amount || 0).toLocaleString()}</div>
        ${buildActivationMeta(member)}
         ${buildActivationMeta(member)}
        <div class="member-meta">Due: ${member.due_date ? formatDate(member.due_date) : "Starts after activation"}</div>
        ${buildProofSection(member)}
      </div>
        <div class="member-actions">
        <button class="activate-btn" ${member.is_activated ? "disabled" : ""}>${getActivationLabel(member)}</button>
        <button class="edit-loan-btn">Edit Loan</button>
        <button class="delete-btn" title="Move to history">Archive</button>
      </div>
    `;

    li.querySelector(".delete-btn").onclick = () => requestArchive(member.id, li);

    
    const proofBtn = li.querySelector(".proof-toggle-btn");
    const proofContainer = li.querySelector(".proof-container");
    if (proofBtn && proofContainer) {
      proofBtn.onclick = () => toggleProofImage(proofBtn, proofContainer, member, "admin");
    }

    li.querySelector(".activate-btn").onclick = async () => {
      const activateRes = await fetch(`/client/${member.id}/activate`, {
        method: "PATCH",
        headers: { "x-admin-token": ADMIN_TOKEN }
      });

      if (!activateRes.ok) {
        alert("Failed to activate member.");
        return;
      }

      await loadMembers();
    };

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
        alert("Failed to update loan amount.");
        return;
      }

      await loadMembers();
    };

    list.appendChild(li);
  });
}

async function loadTeamLeaderMembers() {
  const list = document.getElementById("team-leader-list");
  const total = document.getElementById("team-leader-count");
  const title = document.getElementById("team-leader-dashboard-title");

  if (!list || !total || !title || !TEAM_LEADER_TOKEN) return;

  list.innerHTML = "";
  const res = await fetch("/team-leader/clients", {
    headers: { "x-team-leader-token": TEAM_LEADER_TOKEN }
  });

  if (!res.ok) {
    list.innerHTML = "<li>Failed to load members.</li>";
    total.textContent = "Members: 0";
    return;
  }

  const data = await res.json();
  const members = data.clients || [];
  TEAM_LEADER_NAME = data.teamLeaderName || TEAM_LEADER_NAME;
  title.textContent = `${TEAM_LEADER_NAME} Dashboard`;
  total.textContent = `Members: ${members.length}`;

  if (!members.length) {
    list.innerHTML = "<li>No registered members yet.</li>";
    return;
  }

  members.forEach(member => {
    const li = document.createElement("li");
    li.className = "member-card";
    li.innerHTML = `
      <div class="member-info">
        <div class="member-name">${member.full_name}</div>
        <div class="member-meta">Registered: ${formatDate(member.created_at)}</div>
        <div class="member-meta">DSJ Account No: ${member.dsj_number}</div>
        <div class="member-meta">Wallet Address: ${member.wallet_address || "-"}</div>
        <div class="member-meta">Contact: ${member.contact_number}</div>
        <div class="member-meta">Email: ${member.email || "-"}</div>
        ${buildActivationMeta(member)}
        ${buildProofSection(member)}
      </div>
    `;

    const proofBtn = li.querySelector(".proof-toggle-btn");
    const proofContainer = li.querySelector(".proof-container");
    if (proofBtn && proofContainer) {
      proofBtn.onclick = () => toggleProofImage(proofBtn, proofContainer, member, "teamLeader");
    }

    list.appendChild(li);
  });
}


async function loadActivatedMembers() {
  const list = document.getElementById("activated-list");
  const total = document.getElementById("activated-count");

  if (!list || !total || !ADMIN_TOKEN) return;

  list.innerHTML = "";

  const res = await fetch("/clients", {
    headers: { "x-admin-token": ADMIN_TOKEN }
  });

  if (!res.ok) {
    list.innerHTML = "<li>Failed to load activated members.</li>";
    total.textContent = "Activated Members: 0";
    return;
  }

  const members = await res.json();
  const activatedMembers = members.filter(member => member.is_activated);
  total.textContent = `Activated Members: ${activatedMembers.length}`;

  if (!activatedMembers.length) {
    list.innerHTML = "<li>No activated members.</li>";
    return;
  }

  activatedMembers.forEach(member => {
    const li = document.createElement("li");
    li.className = "member-card";

    li.innerHTML = `
      <div class="member-info">
        <div class="member-name">${member.full_name}</div>
        <div class="member-meta">Team Leader: ${member.team_leader || "-"}</div>
        <div class="member-meta">Registered: ${formatDate(member.created_at)}</div>
        <div class="member-meta">DSJ Account No: ${member.dsj_number}</div>
        <div class="member-meta">Wallet Address: ${member.wallet_address || "-"}</div>
        <div class="member-meta">Contact: ${member.contact_number}</div>
        <div class="member-meta">Loaned Amount: ₱${Number(member.borrow_amount || 0).toLocaleString()}</div>
        ${buildActivationMeta(member)}
        <div class="member-meta">Due: ${member.due_date ? formatDate(member.due_date) : "-"}</div>
        ${buildProofSection(member)}
      </div>
    `;

    const proofBtn = li.querySelector(".proof-toggle-btn");
    const proofContainer = li.querySelector(".proof-container");
    if (proofBtn && proofContainer) {
      proofBtn.onclick = () => toggleProofImage(proofBtn, proofContainer, member, "admin");
    }

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
        <div class="member-meta">Team Leader: ${member.team_leader || "-"}</div>
        <div class="member-meta">Registered: ${formatDate(member.created_at)}</div>
        <div class="member-meta">Archived: ${formatDate(member.archived_at)}</div>
        ${buildProofSection(member)}
      </div>
      <div class="member-actions">
        <button class="danger-btn delete-history-btn" title="Delete permanently">Delete</button>
      </div>
    `;
    
    const proofBtn = li.querySelector(".proof-toggle-btn");
    const proofContainer = li.querySelector(".proof-container");
    if (proofBtn && proofContainer) {
       proofBtn.onclick = () => toggleProofImage(proofBtn, proofContainer, member, "admin");
    }
    
    li.querySelector(".delete-history-btn").onclick = async () => {
      const shouldDelete = confirm(`Delete ${member.full_name} permanently from archived history?`);
      if (!shouldDelete) return;

      const deleteRes = await fetch(`/client/${member.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": ADMIN_TOKEN }
      });

      if (!deleteRes.ok) {
        alert("Failed to delete archived member.");
        return;
      }

      await loadHistory();
    };

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

document.getElementById("member-btn")?.addEventListener("click", () => showPage(memberPage));
document.getElementById("admin-btn")?.addEventListener("click", () => showPage(adminLoginPage));
document.getElementById("team-leader-btn")?.addEventListener("click", () => showPage(teamLeaderLoginPage));
document.getElementById("member-back-btn")?.addEventListener("click", () => showPage(landingPage));
document.getElementById("admin-back-btn")?.addEventListener("click", () => showPage(landingPage));
document.getElementById("team-leader-back-btn")?.addEventListener("click", () => showPage(landingPage));

document.getElementById("admin-dashboard-back-btn")?.addEventListener("click", () => {
  saveAdminToken(null);
  selectedAdminFilter = "";
  showPage(landingPage);
});

document.getElementById("team-leader-dashboard-back-btn")?.addEventListener("click", () => {
  saveTeamLeaderSession(null, null);
  showPage(landingPage);
});

document.getElementById("view-activated-btn")?.addEventListener("click", async () => {
  showPage(adminActivatedPage);
  await loadActivatedMembers();
});

document.getElementById("view-history-btn")?.addEventListener("click", async () => {
  showPage(adminHistoryPage);
  await loadHistory();
});

document.getElementById("activated-back-btn")?.addEventListener("click", async () => {
  showPage(adminPage);
  await loadMembers();
});

document.getElementById("history-back-btn")?.addEventListener("click", async () => {
  showPage(adminPage);
  await loadMembers();
});

document.getElementById("member-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const proofImage = document.getElementById("proof_image").files[0];
  if (!proofImage) return alert("Please upload a proof image.");
  if (!allowedImageTypes.includes(proofImage.type)) return alert("Only JPEG and PNG files are allowed.");
  if (proofImage.size > maxProofSizeBytes) return alert("Proof image must be 2MB or smaller.");

  const proofImageData = await proofImage.arrayBuffer();
  const bytes = new Uint8Array(proofImageData);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64Proof = btoa(binary);

  const firstNameInput = document.getElementById("first_name").value.trim();
  const lastNameInput = document.getElementById("last_name").value.trim();
  const teamLeaderInput = document.getElementById("team_leader").value.trim().toUpperCase();

  if (!firstNameInput || !lastNameInput || !teamLeaderInput) {
    alert("First name, last name, and team leader are required.");
    return;
  }

  const res = await fetch("/client", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: firstNameInput.toUpperCase(),
      lastName: lastNameInput.toUpperCase(),
      contactNumber: document.getElementById("contact").value,
      email: document.getElementById("email").value,
      dsjNumber: document.getElementById("dsj_account").value,
      walletAddress: document.getElementById("wallet_address").value,
      teamLeader: teamLeaderInput,
      proofImageData: base64Proof,
      proofImageType: proofImage.type
    })
  });

  if (res.ok) {
    alert("Registration successful! Loan is pending activation by admin.");
    e.target.reset();
    showPage(landingPage);
    return;
  }

  const err = await res.json().catch(() => ({ error: "Registration failed" }));
  alert(err.error || "Registration failed");
});

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

  if (!res.ok) {
    msg.textContent = "Invalid admin credentials";
    return;
  }

  const data = await res.json();
  saveAdminToken(data.token);
  msg.textContent = "";

  await fetchTeamLeaders();
  renderTeamLeaderFilters();
  showPage(adminPage);
  await loadMembers();
});

document.getElementById("team-leader-login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("team-leader-username").value.trim();
  const password = document.getElementById("team-leader-password").value.trim();
  const msg = document.getElementById("team-leader-msg");

  const res = await fetch("/team-leader/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    msg.textContent = "Invalid team leader credentials";
    return;
  }

  const data = await res.json();
  saveTeamLeaderSession(data.token, data.teamLeaderName);
  msg.textContent = "";

  showPage(teamLeaderPage);
  await loadTeamLeaderMembers();
});

async function restoreAdminSession() {
  const storedToken = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  if (!storedToken) return false;

  ADMIN_TOKEN = storedToken;
  const res = await fetch("/clients", {
    headers: { "x-admin-token": ADMIN_TOKEN }
  });

  if (!res.ok) {
    saveAdminToken(null);
    return false;
  }

  await fetchTeamLeaders();
  renderTeamLeaderFilters();
  showPage(adminPage);
  await loadMembers();
  return true;
}

async function restoreTeamLeaderSession() {
  const storedToken = localStorage.getItem(TEAM_LEADER_TOKEN_STORAGE_KEY);
  const storedName = localStorage.getItem(TEAM_LEADER_NAME_STORAGE_KEY);
  if (!storedToken) return false;

  TEAM_LEADER_TOKEN = storedToken;
  TEAM_LEADER_NAME = storedName;

  const res = await fetch("/team-leader/clients", {
    headers: { "x-team-leader-token": TEAM_LEADER_TOKEN }
  });

  if (!res.ok) {
    saveTeamLeaderSession(null, null);
    return false;
  }

  showPage(teamLeaderPage);
  await loadTeamLeaderMembers();
  return true;
}


showPage(landingPage);
restoreAdminSession().then(async (adminRestored) => {
  if (!adminRestored) await restoreTeamLeaderSession();
});