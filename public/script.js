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

const DSJ_ACCOUNT_LENGTH = 12;
const WALLET_ADDRESS_LENGTH = 42;

let ADMIN_TOKEN = null;
let TEAM_LEADER_TOKEN = null;
let TEAM_LEADER_NAME = null;
let selectedAdminFilter = "";
let selectedActivatedFilter = "";
let teamLeadersCache = [];

/*********************************
 * PAGE SWITCHER (NULL-SAFE)
 *********************************/
function showPage(page) {
   [landingPage, memberPage, adminLoginPage, teamLeaderLoginPage, adminPage, teamLeaderPage, adminHistoryPage, adminActivatedPage].forEach(p => {
    if (!p) return;
    p.classList.add("hidden");
    p.style.display = "none";
  });

  if (!page) return;

  page.classList.remove("hidden")
  page.style.display = page === landingPage ? "flex" : "block";
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

function buildActivationProofSection(member) {
  if (!member.has_activation_proof) return '<div class="member-meta">Activation Proof: Not uploaded</div>';

  return `
    <div class="member-meta">Activation Proof: <button class="activation-proof-toggle-btn" type="button">View Activation Proof</button></div>
    <div class="activation-proof-container"></div>
  `;
}

async function toBase64(file) {
  const imageData = await file.arrayBuffer();
  const bytes = new Uint8Array(imageData);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function toggleProofImage(button, container, member, mode = "admin", options = {}) {
  if (!button || !container) return;

  const {
    endpoint = "proof",
    loadingText = "Loading...",
    errorFallback = "Failed to load proof image.",
    viewLabel = "View Proof",
    hideLabel = "Hide Proof",
    altLabel = "Proof"
  } = options;

  const isVisible = container.dataset.visible === "true";
  if (isVisible) {
    container.innerHTML = "";
    container.dataset.visible = "false";
    button.textContent = viewLabel;
    return;
  }

  if (!container.dataset.loaded) {
    button.disabled = true;
    button.textContent = loadingText;
     
    const headers = {};
    if (mode === "teamLeader") {
      headers["x-team-leader-token"] = TEAM_LEADER_TOKEN;
    } else {
      headers["x-admin-token"] = ADMIN_TOKEN;
    }

    const res = await fetch(`/client/${member.id}/${endpoint}`, { headers });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: errorFallback }));
      alert(err.error || errorFallback);
      button.disabled = false;
      button.textContent = viewLabel;
      return;
    }

    const proof = await res.json();
    container.innerHTML = `<img class="proof-image" src="data:${proof.proof_mime};base64,${proof.proof_image_data}" alt="${altLabel} uploaded by ${member.full_name}">`;
    container.dataset.loaded = "true";
    button.disabled = false;
  }

  container.dataset.visible = "true";
  button.textContent = hideLabel;
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

function renderTeamLeaderOptions() {
  const select = document.getElementById("team_leader");
  if (!select) return;

  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select Team Leader";
  select.appendChild(placeholder);

  teamLeadersCache.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
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

function renderActivatedTeamLeaderFilters() {
  const container = document.getElementById("activated-team-leader-filters");
  if (!container) return;

  container.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.className = `secondary-btn filter-btn ${selectedActivatedFilter === "" ? "active-filter" : ""}`;
  allBtn.textContent = "All Team Leaders";
  allBtn.onclick = async () => {
    selectedActivatedFilter = "";
    renderActivatedTeamLeaderFilters();
    await loadActivatedMembers();
  };
  container.appendChild(allBtn);

  teamLeadersCache.forEach(name => {
    const btn = document.createElement("button");
    btn.className = `secondary-btn filter-btn ${selectedActivatedFilter === name ? "active-filter" : ""}`;
    btn.textContent = name;
    btn.onclick = async () => {
      selectedActivatedFilter = name;
      renderActivatedTeamLeaderFilters();
      await loadActivatedMembers();
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

  let res;
  try {
    res = await fetch(`/clients${query}`, {
      headers: { "x-admin-token": ADMIN_TOKEN }
    });
  } catch (_err) {
    list.innerHTML = "<li>Failed to load members. Please check your connection.</li>";
    total.textContent = "Pending Members: 0";
    return;
  }

  if (!res.ok) {
    list.innerHTML = "<li>Failed to load members.</li>";
    total.textContent = "Pending Members: 0";
    return;
  }

  const payload = await res.json().catch(() => []);
  const members = Array.isArray(payload) ? payload : (Array.isArray(payload.clients) ? payload.clients : []);
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
        <div class="member-meta">Due: ${member.due_date ? formatDate(member.due_date) : "Starts after activation"}</div>
        ${buildProofSection(member)}
        ${buildActivationProofSection(member)}
      </div>
        <div class="member-actions">
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

    const activationProofBtn = li.querySelector(".activation-proof-toggle-btn");
    const activationProofContainer = li.querySelector(".activation-proof-container");
    if (activationProofBtn && activationProofContainer) {
      activationProofBtn.onclick = () => toggleProofImage(activationProofBtn, activationProofContainer, member, "admin", {
        endpoint: "activation-proof",
        errorFallback: "Failed to load activation proof image.",
        viewLabel: "View Activation Proof",
        hideLabel: "Hide Activation Proof",
        altLabel: "Activation proof"
      });
    }
      
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
        ${buildActivationProofSection(member)}
      </div>
      <div class="member-actions">
        <button class="activate-btn" ${member.is_activated ? "disabled" : ""}>${getActivationLabel(member)}</button>
        <input class="activation-proof-input hidden" type="file" accept="image/jpeg,image/png">
      </div>
    `;

    const proofBtn = li.querySelector(".proof-toggle-btn");
    const proofContainer = li.querySelector(".proof-container");
    if (proofBtn && proofContainer) {
      proofBtn.onclick = () => toggleProofImage(proofBtn, proofContainer, member, "teamLeader");
    }

    const activationProofBtn = li.querySelector(".activation-proof-toggle-btn");
    const activationProofContainer = li.querySelector(".activation-proof-container");
    if (activationProofBtn && activationProofContainer) {
      activationProofBtn.onclick = () => toggleProofImage(activationProofBtn, activationProofContainer, member, "teamLeader", {
        endpoint: "activation-proof",
        errorFallback: "Failed to load activation proof image.",
        viewLabel: "View Activation Proof",
        hideLabel: "Hide Activation Proof",
        altLabel: "Activation proof"
      });
    }

    const activateBtn = li.querySelector(".activate-btn");
    const activationProofInput = li.querySelector(".activation-proof-input");

    if (activateBtn && activationProofInput && !member.is_activated) {
      activateBtn.onclick = () => activationProofInput.click();

      activationProofInput.onchange = async () => {
        const file = activationProofInput.files?.[0];
        activationProofInput.value = "";

        if (!file) return;
        if (!allowedImageTypes.includes(file.type)) {
          alert("Only JPEG and PNG files are allowed.");
          return;
        }
        if (file.size > maxProofSizeBytes) {
          alert("Activation proof image must be 2MB or smaller.");
          return;
        }

        const base64Proof = await toBase64(file);
        const activateRes = await fetch(`/team-leader/client/${member.id}/activate`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-team-leader-token": TEAM_LEADER_TOKEN
          },
          body: JSON.stringify({
            proofImageData: base64Proof,
            proofImageType: file.type
          })
        });

        if (!activateRes.ok) {
          const err = await activateRes.json().catch(() => ({ error: "Failed to activate member." }));
          alert(err.error || "Failed to activate member.");
          return;
        }

        alert("Loan activated successfully.");
        await loadTeamLeaderMembers();
      };
    }

    list.appendChild(li);
  });
}


async function loadActivatedMembers() {
  const list = document.getElementById("activated-list");
  const total = document.getElementById("activated-count");

  if (!list || !total || !ADMIN_TOKEN) return;

  list.innerHTML = "";
  renderActivatedTeamLeaderFilters();

  const query = selectedActivatedFilter ? `?teamLeader=${encodeURIComponent(selectedActivatedFilter)}` : "";
  
  let res;
  try {
    res = await fetch(`/clients/activated${query}`, {
      headers: { "x-admin-token": ADMIN_TOKEN }
    });
  } catch (_err) {
    list.innerHTML = "<li>Failed to load activated members. Please check your connection.</li>";
    total.textContent = "Activated Members: 0";
    return;
  }

  if (!res.ok) {
    list.innerHTML = "<li>Failed to load activated members.</li>";
    total.textContent = "Activated Members: 0";
    return;
  }

  const payload = await res.json().catch(() => []);
  const activatedMembers = Array.isArray(payload) ? payload : (Array.isArray(payload.clients) ? payload.clients : []);
  activatedMembers.sort((a, b) => {
    const leaderA = (a.team_leader || "").toUpperCase();
    const leaderB = (b.team_leader || "").toUpperCase();
    if (leaderA !== leaderB) return leaderA.localeCompare(leaderB);

    const activatedA = a.activated_at ? new Date(a.activated_at).getTime() : 0;
    const activatedB = b.activated_at ? new Date(b.activated_at).getTime() : 0;
    if (activatedA !== activatedB) return activatedB - activatedA;

    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdB - createdA;
  });
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
        <div class="member-meta">Team Leader: <button type="button" class="team-leader-member-filter-btn" data-team-leader="${member.team_leader || ""}" ${member.team_leader ? "" : "disabled"}>${member.team_leader || "-"}</button></div>
        <div class="member-meta">Registered: ${formatDate(member.created_at)}</div>
        <div class="member-meta">DSJ Account No: ${member.dsj_number}</div>
        <div class="member-meta">Wallet Address: ${member.wallet_address || "-"}</div>
        <div class="member-meta">Contact: ${member.contact_number}</div>
        <div class="member-meta">Loaned Amount: ₱${Number(member.borrow_amount || 0).toLocaleString()}</div>
        ${buildActivationMeta(member)}
        <div class="member-meta">Due: ${member.due_date ? formatDate(member.due_date) : "-"}</div>
        ${buildProofSection(member)}
        ${buildActivationProofSection(member)}
      </div>
      <div class="member-actions">
        <button class="danger-btn archive-btn" title="Move to history">Archive User</button>
      </div>
    `;

    li.querySelector(".archive-btn").onclick = () => requestArchive(member.id, li);

    const teamLeaderFilterBtn = li.querySelector(".team-leader-member-filter-btn");
    if (teamLeaderFilterBtn && teamLeaderFilterBtn.dataset.teamLeader) {
      teamLeaderFilterBtn.onclick = async () => {
        selectedActivatedFilter = teamLeaderFilterBtn.dataset.teamLeader;
        renderActivatedTeamLeaderFilters();
        await loadActivatedMembers();
      };
    }

    const proofBtn = li.querySelector(".proof-toggle-btn");
    const proofContainer = li.querySelector(".proof-container");
    if (proofBtn && proofContainer) {
      proofBtn.onclick = () => toggleProofImage(proofBtn, proofContainer, member, "admin");
    }
    
    const activationProofBtn = li.querySelector(".activation-proof-toggle-btn");
    const activationProofContainer = li.querySelector(".activation-proof-container");
    if (activationProofBtn && activationProofContainer) {
      activationProofBtn.onclick = () => toggleProofImage(activationProofBtn, activationProofContainer, member, "admin", {
        endpoint: "activation-proof",
        errorFallback: "Failed to load activation proof image.",
        viewLabel: "View Activation Proof",
        hideLabel: "Hide Activation Proof",
        altLabel: "Activation proof"
      });
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
        ${buildActivationProofSection(member)}
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

  await Promise.all([loadMembers(), loadActivatedMembers()]);
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
  selectedActivatedFilter = "";
  showPage(landingPage);
});

document.getElementById("team-leader-dashboard-back-btn")?.addEventListener("click", () => {
  saveTeamLeaderSession(null, null);
  showPage(landingPage);
});

document.getElementById("view-activated-btn")?.addEventListener("click", async () => {
  showPage(adminActivatedPage);
  renderActivatedTeamLeaderFilters();
  await loadActivatedMembers();
});

document.getElementById("view-history-btn")?.addEventListener("click", async () => {
  showPage(adminHistoryPage);
  await loadHistory();
});

document.getElementById("activated-back-btn")?.addEventListener("click", async () => {
  selectedActivatedFilter = "";
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

  const base64Proof = await toBase64(proofImage);

  const firstNameInput = document.getElementById("first_name").value.trim();
  const lastNameInput = document.getElementById("last_name").value.trim();
  const teamLeaderInput = document.getElementById("team_leader").value.trim();
  const dsjNumberInput = document.getElementById("dsj_account").value.trim();
  const walletAddressInput = document.getElementById("wallet_address").value.trim();


  if (!firstNameInput || !lastNameInput || !teamLeaderInput) {
    alert("First name, last name, and team leader are required.");
    return;
  }
  if (dsjNumberInput.length !== DSJ_ACCOUNT_LENGTH) {
    alert(`DSJ Account Number must be exactly ${DSJ_ACCOUNT_LENGTH} characters.`);
    return;
  }

  if (walletAddressInput.length !== WALLET_ADDRESS_LENGTH) {
    alert(`DSJ Wallet Address must be exactly ${WALLET_ADDRESS_LENGTH} characters.`);
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
      dsjNumber: dsjNumberInput,
      walletAddress: walletAddressInput,
      teamLeader: teamLeaderInput,
      proofImageData: base64Proof,
      proofImageType: proofImage.type
    })
  });

  if (res.ok) {
    alert("Registration successful! Loan is pending activation by your team leader.");
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
  renderTeamLeaderOptions();
  renderTeamLeaderFilters();
  renderActivatedTeamLeaderFilters();
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
  renderTeamLeaderOptions();
  renderTeamLeaderFilters();
  renderActivatedTeamLeaderFilters();
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

fetchTeamLeaders().then(() => renderTeamLeaderOptions());

restoreAdminSession().then(async (adminRestored) => {
  if (!adminRestored) await restoreTeamLeaderSession();
});