// Simple in-memory session store
const sessions = [];
const WEEKLY_GOAL = 5;

const statSessions = document.getElementById("statSessions");
const statMinutes = document.getElementById("statMinutes");
const statIntensity = document.getElementById("statIntensity");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const sessionList = document.getElementById("sessionList");
const sessionCountChip = document.getElementById("sessionCountChip");
const formMessage = document.getElementById("formMessage");
const todayFocusText = document.getElementById("todayFocusText");

// PILL TOGGLE (On-court / Off-court)
const pillButtons = document.querySelectorAll(".pill-row .pill");
const sessionTypeInput = document.getElementById("sessionType");

pillButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        pillButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        sessionTypeInput.value = btn.dataset.type;
    });
});

// FORM SUBMIT
const form = document.getElementById("sessionForm");
form.addEventListener("submit", (e) => {
    e.preventDefault();
    formMessage.textContent = "";

    const type = sessionTypeInput.value;
    const focus = document.getElementById("focus").value.trim();
    const minutesValue = document.getElementById("minutes").value;
    const intensityValue = document.getElementById("intensity").value;

    const minutes = Number(minutesValue);
    const intensity = Number(intensityValue);

    if (!focus) {
        formMessage.textContent = "Add a focus so you know what you trained.";
        formMessage.style.color = "#fb7185";
        return;
    }

    if (!minutes || minutes < 5) {
        formMessage.textContent = "Minutes should be at least 5.";
        formMessage.style.color = "#fb7185";
        return;
    }

    const session = {
        id: Date.now(),
        type,
        focus,
        minutes,
        intensity,
        createdAt: new Date()
    };

    sessions.unshift(session);
    form.reset();
    sessionTypeInput.value = "On-court";
    pillButtons.forEach(b => {
        b.classList.toggle("active", b.dataset.type === "On-court");
    });

    formMessage.textContent = "Session logged. Nice.";
    formMessage.style.color = "#a5b4fc";

    render();
});

// RENDER FUNCTIONS

function render() {
    renderStats();
    renderSessions();
    updateTodayFocus();
}

function renderStats() {
    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
    const avgIntensity = totalSessions
        ? (sessions.reduce((sum, s) => sum + s.intensity, 0) / totalSessions).toFixed(1)
        : 0;

    statSessions.textContent = totalSessions;
    statMinutes.textContent = totalMinutes;
    statIntensity.textContent = avgIntensity;

    const progress = Math.min((totalSessions / WEEKLY_GOAL) * 100, 100);
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${Math.min(totalSessions, WEEKLY_GOAL)} / ${WEEKLY_GOAL}`;
}

function renderSessions() {
    sessionList.innerHTML = "";

    if (!sessions.length) {
        const p = document.createElement("p");
        p.className = "empty-state";
        p.textContent = "No sessions yet. First one sets the tone.";
        sessionList.appendChild(p);
        sessionCountChip.textContent = "0 logged";
        return;
    }

    sessions.forEach((s) => {
        const item = document.createElement("div");
        item.className = "session-item";

        const left = document.createElement("div");
        left.className = "session-main";

        const typeBadge = document.createElement("span");
        typeBadge.className = "session-type" + (s.type === "Off-court" ? " off" : "");
        typeBadge.innerHTML = `<i class="fa-solid ${s.type === "Off-court" ? "fa-dumbbell" : "fa-table-tennis-paddle-ball"}"></i> ${s.type}`;

        const focus = document.createElement("span");
        focus.className = "session-focus";
        focus.textContent = s.focus;

        const meta = document.createElement("span");
        meta.className = "session-meta";
        meta.textContent = `${s.minutes} min • Intensity ${s.intensity}`;

        left.appendChild(typeBadge);
        left.appendChild(focus);
        left.appendChild(meta);

        const right = document.createElement("div");
        right.className = "session-right";
        right.textContent = timeAgo(s.createdAt);

        item.appendChild(left);
        item.appendChild(right);

        sessionList.appendChild(item);
    });

    sessionCountChip.textContent = `${sessions.length} logged`;
}

function timeAgo(date) {
    const d = new Date(date);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD} d ago`;
}

function updateTodayFocus() {
    if (!sessions.length) return;

    const latest = sessions[0];
    const label =
        latest.type === "Off-court"
            ? `Off-court: ${latest.focus}`
            : `On-court: ${latest.focus}`;

    todayFocusText.textContent = label;
}

// Initial render
render();
