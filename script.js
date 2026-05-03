const STORAGE_KEY = "badmintion-state-v1";

let state = {
  sessions: [],
  plans: [],
  activePlanId: null,
  weeklyGoal: 5,
  streakDays: 0,
  lastSessionDate: null,
  weekId: null,
  weeklyCompletionHistory: []
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (e) {
    console.warn("Failed to load state", e);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCurrentWeekId() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day;
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().slice(0, 10);
}

function ensureWeek() {
  const currentWeekId = getCurrentWeekId();
  if (!state.weekId) {
    state.weekId = currentWeekId;
    saveState();
    return;
  }
  if (state.weekId !== currentWeekId) {
    archiveWeeklyCompletion();
    resetPlanCompletion();
    state.weekId = currentWeekId;
    saveState();
    renderAll();
  }
}

function archiveWeeklyCompletion() {
  const activePlan = state.plans.find(p => p.id === state.activePlanId);
  if (!activePlan) return;
  const total = activePlan.items.length || 1;
  const done = activePlan.items.filter(i => i.done).length;
  const percent = Math.round((done / total) * 100);
  state.weeklyCompletionHistory.push({
    weekId: state.weekId,
    completionPercent: percent
  });
}

function resetPlanCompletion() {
  state.plans = state.plans.map(plan => ({
    ...plan,
    items: plan.items.map(item => ({ ...item, done: false }))
  }));
}

// DOM refs
const views = {
  home: document.getElementById("view-home"),
  plans: document.getElementById("view-plans"),
  sessions: document.getElementById("view-sessions"),
  stats: document.getElementById("view-stats"),
  profile: document.getElementById("view-profile")
};

const navButtons = document.querySelectorAll(".nav-btn");

const statSessionsEl = document.getElementById("statSessions");
const statMinutesEl = document.getElementById("statMinutes");
const statIntensityEl = document.getElementById("statIntensity");
const progressTextEl = document.getElementById("progressText");
const progressFillEl = document.getElementById("progressFill");
const weeklyGoalLabelEl = document.getElementById("weeklyGoalLabel");
const homePlanPreviewEl = document.getElementById("homePlanPreview");
const plansListEl = document.getElementById("plansList");
const sessionListEl = document.getElementById("sessionList");
const weeklyCompletionTextEl = document.getElementById("weeklyCompletionText");
const categoryBreakdownEl = document.getElementById("categoryBreakdown");
const streakLabelEl = document.getElementById("streakLabel");

// Modals
const sessionModalEl = document.getElementById("sessionModal");
const sessionModalErrorEl = document.getElementById("sessionModalError");
const sessionFocusInput = document.getElementById("sessionFocus");
const sessionMinutesInput = document.getElementById("sessionMinutes");
const sessionIntensitySelect = document.getElementById("sessionIntensity");
let sessionModalType = "On-court";

const planModalEl = document.getElementById("planModal");
const planModalErrorEl = document.getElementById("planModalError");
const planNameInput = document.getElementById("planName");
const planItemsInput = document.getElementById("planItems");

// INIT
loadState();
ensureWeek();
renderAll();
attachEvents();

// NAV
function switchView(target) {
  Object.values(views).forEach(v => v.classList.remove("view-active"));
  views[target].classList.add("view-active");

  navButtons.forEach(btn => {
    btn.classList.toggle("nav-active", btn.dataset.target === target);
  });
}

// RENDER
function renderAll() {
  renderHome();
  renderPlans();
  renderSessions();
  renderStats();
  renderStreak();
}

function renderHome() {
  const sessionsThisWeek = state.sessions.filter(s => s.weekId === state.weekId);
  const totalSessions = sessionsThisWeek.length;
  const totalMinutes = sessionsThisWeek.reduce((sum, s) => sum + s.minutes, 0);
  const avgIntensity =
    totalSessions === 0
      ? 0
      : (
          sessionsThisWeek.reduce((sum, s) => sum + s.intensity, 0) /
          totalSessions
        ).toFixed(1);

  statSessionsEl.textContent = totalSessions;
  statMinutesEl.textContent = totalMinutes;
  statIntensityEl.textContent = avgIntensity;

  weeklyGoalLabelEl.textContent = `Goal: ${state.weeklyGoal} sessions`;
  progressTextEl.textContent = `${totalSessions} / ${state.weeklyGoal}`;
  const pct = Math.min(100, (totalSessions / state.weeklyGoal) * 100);
  progressFillEl.style.width = `${pct}%`;

  const activePlan = state.plans.find(p => p.id === state.activePlanId);
  if (!activePlan) {
    homePlanPreviewEl.className = "plan-preview-empty";
    homePlanPreviewEl.textContent =
      "No active plan yet. Create one in Plans.";
    return;
  }

  homePlanPreviewEl.className = "plan-preview-list";
  homePlanPreviewEl.innerHTML = "";
  activePlan.items.slice(0, 3).forEach(item => {
    const row = document.createElement("div");
    row.className = "plan-preview-item";
    const icon = item.done ? "fa-check-circle" : "fa-circle";
    row.innerHTML = `<i class="fa-regular ${icon}"></i><span>${item.label}</span>`;
    homePlanPreviewEl.appendChild(row);
  });
  if (activePlan.items.length > 3) {
    const more = document.createElement("span");
    more.className = "tag-muted";
    more.textContent = `+${activePlan.items.length - 3} more`;
    homePlanPreviewEl.appendChild(more);
  }
}

function renderPlans() {
  plansListEl.innerHTML = "";
  if (state.plans.length === 0) {
    plansListEl.innerHTML =
      '<p class="empty-state">No plans yet. Create your first one.</p>';
    return;
  }

  state.plans.forEach(plan => {
    const wrapper = document.createElement("div");
    wrapper.className = "list-item";

    const header = document.createElement("div");
    header.className = "list-item-header";

    const title = document.createElement("h4");
    title.className = "list-item-title";
    title.textContent = plan.name;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "6px";

    const completion =
      plan.items.length === 0
        ? 0
        : Math.round(
            (plan.items.filter(i => i.done).length / plan.items.length) * 100
          );

    const chip = document.createElement("span");
    chip.className = "chip chip-soft";
    chip.textContent = `${completion}%`;

    const activeBtn = document.createElement("button");
    activeBtn.className = "pill pill-small";
    activeBtn.textContent =
      state.activePlanId === plan.id ? "Active" : "Set active";
    if (state.activePlanId === plan.id) {
      activeBtn.classList.add("pill-active");
    }
    activeBtn.addEventListener("click", () => {
      state.activePlanId = plan.id;
      saveState();
      renderAll();
    });

    right.appendChild(chip);
    right.appendChild(activeBtn);

    header.appendChild(title);
    header.appendChild(right);

    const sub = document.createElement("p");
    sub.className = "list-item-sub";
    sub.textContent = `${plan.items.length} items`;

    const itemsContainer = document.createElement("div");
    itemsContainer.style.marginTop = "6px";
    itemsContainer.style.display = "flex";
    itemsContainer.style.flexDirection = "column";
    itemsContainer.style.gap = "4px";

    plan.items.forEach(item => {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      row.style.fontSize = "0.8rem";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.done;
      checkbox.addEventListener("change", () => {
        item.done = checkbox.checked;
        saveState();
        renderAll();
      });

      const span = document.createElement("span");
      span.textContent = item.label;

      row.appendChild(checkbox);
      row.appendChild(span);
      itemsContainer.appendChild(row);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(sub);
    wrapper.appendChild(itemsContainer);

    plansListEl.appendChild(wrapper);
  });
}

function renderSessions(filter = "all") {
  sessionListEl.innerHTML = "";
  let sessions = state.sessions.slice().sort((a, b) => b.date - a.date);
  if (filter !== "all") {
    sessions = sessions.filter(s => s.type === filter);
  }

  if (sessions.length === 0) {
    sessionListEl.innerHTML =
      '<p class="empty-state">No sessions yet. Log your first one.</p>';
    return;
  }

  sessions.forEach(s => {
    const item = document.createElement("div");
    item.className = "list-item";

    const header = document.createElement("div");
    header.className = "list-item-header";

    const title = document.createElement("h4");
    title.className = "list-item-title";
    title.textContent = `${s.type} • ${s.minutes} min`;

    const tag = document.createElement("span");
    tag.className = "tag-soft";
    const date = new Date(s.date);
    tag.textContent = date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });

    header.appendChild(title);
    header.appendChild(tag);

    const sub = document.createElement("p");
    sub.className = "list-item-sub";
    sub.textContent = `${s.focus || "No focus"} • Intensity ${s.intensity}`;

    item.appendChild(header);
    item.appendChild(sub);

    sessionListEl.appendChild(item);
  });
}

function renderStats() {
  if (state.weeklyCompletionHistory.length === 0) {
    weeklyCompletionTextEl.textContent =
      "No data yet. Complete a plan week to see trends.";
  } else {
    const last = state.weeklyCompletionHistory.slice(-1)[0];
    weeklyCompletionTextEl.textContent = `Last week: ${last.completionPercent}% of your plan completed.`;
  }

  categoryBreakdownEl.innerHTML = "";
  if (state.sessions.length === 0) {
    categoryBreakdownEl.innerHTML = '<span class="tag-soft">No data yet</span>';
    return;
  }

  const counts = { "On-court": 0, "Off-court": 0 };
  state.sessions.forEach(s => {
    if (counts[s.type] != null) counts[s.type]++;
  });

  Object.entries(counts).forEach(([type, count]) => {
    const span = document.createElement("span");
    span.className = "tag-soft";
    span.textContent = `${type}: ${count}`;
    categoryBreakdownEl.appendChild(span);
  });
}

function renderStreak() {
  streakLabelEl.textContent = `Streak: ${state.streakDays} days`;
}

// EVENTS
function attachEvents() {
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      switchView(btn.dataset.target);
    });
  });

  document.getElementById("btnQuickLog").addEventListener("click", () => {
    openSessionModal();
  });

  sessionModalEl
    .querySelectorAll(".pill[data-type]")
    .forEach(pill => {
      pill.addEventListener("click", () => {
        sessionModalEl
          .querySelectorAll(".pill[data-type]")
          .forEach(p => p.classList.remove("pill-active"));
        pill.classList.add("pill-active");
        sessionModalType = pill.dataset.type;
      });
    });

  document
    .getElementById("sessionModalCancel")
    .addEventListener("click", closeSessionModal);
  document
    .getElementById("sessionModalSave")
    .addEventListener("click", saveSessionFromModal);

  document.getElementById("btnNewPlan").addEventListener("click", () => {
    openPlanModal();
  });
  document
    .getElementById("planModalCancel")
    .addEventListener("click", closePlanModal);
  document
    .getElementById("planModalSave")
    .addEventListener("click", savePlanFromModal);

  document
    .querySelectorAll("[data-filter]")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("[data-filter]")
          .forEach(b => b.classList.remove("pill-active"));
        btn.classList.add("pill-active");
        renderSessions(btn.dataset.filter);
      });
    });
}

// SESSION MODAL
function openSessionModal() {
  sessionModalErrorEl.textContent = "";
  sessionFocusInput.value = "";
  sessionMinutesInput.value = "";
  sessionIntensitySelect.value = "2";
  sessionModalType = "On-court";
  sessionModalEl
    .querySelectorAll(".pill[data-type]")
    .forEach(p => {
      p.classList.toggle("pill-active", p.dataset.type === "On-court");
    });
  sessionModalEl.style.display = "flex";
}

function closeSessionModal() {
  sessionModalEl.style.display = "none";
}

function saveSessionFromModal() {
  const focus = sessionFocusInput.value.trim();
  const minutes = parseInt(sessionMinutesInput.value, 10);
  const intensity = parseInt(sessionIntensitySelect.value, 10);

  if (!minutes || minutes < 5) {
    sessionModalErrorEl.textContent = "Enter at least 5 minutes.";
    return;
  }

  const now = new Date();
  const weekId = getCurrentWeekId();

  const session = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type: sessionModalType,
    focus,
    minutes,
    intensity,
    date: now.getTime(),
    weekId
  };

  state.sessions.push(session);
  updateStreak(now);
  saveState();
  ensureWeek();
  renderAll();
  closeSessionModal();
}

function updateStreak(now) {
  const todayId = new Date(now.toDateString()).getTime();
  if (!state.lastSessionDate) {
    state.streakDays = 1;
  } else {
    const last = new Date(state.lastSessionDate);
    const lastId = new Date(last.toDateString()).getTime();
    const diffDays = (todayId - lastId) / (1000 * 60 * 60 * 24);
    if (diffDays === 0) {
      // same day
    } else if (diffDays === 1) {
      state.streakDays += 1;
    } else if (diffDays > 1) {
      state.streakDays = 1;
    }
  }
  state.lastSessionDate = now.getTime();
}

// PLAN MODAL
function openPlanModal() {
  planModalErrorEl.textContent = "";
  planNameInput.value = "";
  planItemsInput.value = "";
  planModalEl.style.display = "flex";
}

function closePlanModal() {
  planModalEl.style.display = "none";
}

function savePlanFromModal() {
  const name = planNameInput.value.trim();
  const lines = planItemsInput.value
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (!name) {
    planModalErrorEl.textContent = "Give your plan a name.";
    return;
  }
  if (lines.length === 0) {
    planModalErrorEl.textContent = "Add at least one item.";
    return;
  }

  const plan = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    items: lines.map(label => ({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
      label,
      done: false
    }))
  };

  state.plans.push(plan);
  if (!state.activePlanId) {
    state.activePlanId = plan.id;
  }
  saveState();
  renderAll();
  closePlanModal();
}
