// --- Firebase imports (CDN, modular v9+ style) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// --- Your Firebase config (from console) ---
const firebaseConfig = {
  apiKey: "AIzaSyDsz9V6KSClWXphdQYs4SJJqaOpl2C7wm8",
  authDomain: "badmintontracka.firebaseapp.com",
  projectId: "badmintontracka",
  storageBucket: "badmintontracka.firebasestorage.app",
  messagingSenderId: "774031069419",
  appId: "1:774031069419:web:76530d3409a672aebeae",
  measurementId: "G-HXH8FRYZER"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- In-memory session store + constants ---
const sessions = [];
const WEEKLY_GOAL = 5;

// --- DOM references (existing UI) ---
const statSessions = document.getElementById("statSessions");
const statMinutes = document.getElementById("statMinutes");
const statIntensity = document.getElementById("statIntensity");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const sessionList = document.getElementById("sessionList");
const sessionCountChip = document.getElementById("sessionCountChip");
const formMessage = document.getElementById("formMessage");
const todayFocusText = document.getElementById("todayFocusText");

// --- Auth UI elements ---
const authStatus = document.getElementById("authStatus");
const cloudStatus = document.getElementById("cloudStatus");
const btnGoogle = document.getElementById("btnGoogle");
const btnEmail = document.getElementById("btnEmail");
const btnLogout = document.getElementById("btnLogout");

// Email modal elements
const emailModal = document.getElementById("emailModal");
const emailForm = document.getElementById("emailForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const emailError = document.getElementById("emailError");
const emailModalClose = document.getElementById("emailModalClose");

// --- Auth state ---
let currentUser = null;

// --- PILL TOGGLE (On-court / Off-court) ---
const pillButtons = document.querySelectorAll(".pill-row .pill");
const sessionTypeInput = document.getElementById("sessionType");

pillButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        pillButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        sessionTypeInput.value = btn.dataset.type;
    });
});

// --- FORM SUBMIT ---
const form = document.getElementById("sessionForm");
form.addEventListener("submit", async (e) => {
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
        createdAt: new Date().toISOString()
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

    // Save to cloud if logged in
    if (currentUser) {
        try {
            cloudStatus.textContent = "Cloud: saving…";
            await addDoc(
                collection(db, "users", currentUser.uid, "sessions"),
                session
            );
            cloudStatus.textContent = "Cloud: saved";
        } catch (err) {
            console.error(err);
            cloudStatus.textContent = "Cloud: error saving";
        }
    }
});

// --- RENDER FUNCTIONS ---

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

// --- Cloud sync helpers ---

async function loadSessionsFromCloud(user) {
    try {
        cloudStatus.textContent = "Cloud: loading…";
        const q = query(
            collection(db, "users", user.uid, "sessions"),
            orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);

        sessions.length = 0;
        snap.forEach(doc => {
            const data = doc.data();
            sessions.push({
                id: doc.id,
                type: data.type,
                focus: data.focus,
                minutes: data.minutes,
                intensity: data.intensity,
                createdAt: data.createdAt
            });
        });

        render();
        cloudStatus.textContent = "Cloud: loaded";
    } catch (err) {
        console.error(err);
        cloudStatus.textContent = "Cloud: error loading";
    }
}

function updateAuthUI(user) {
    if (user) {
        authStatus.textContent = `Signed in as ${user.email || "player"}`;
        btnGoogle.style.display = "none";
        btnEmail.style.display = "none";
        btnLogout.style.display = "inline-flex";
    } else {
        authStatus.textContent = "Not signed in";
        btnGoogle.style.display = "inline-flex";
        btnEmail.style.display = "inline-flex";
        btnLogout.style.display = "none";
        cloudStatus.textContent = "Cloud: idle";
    }
}

// --- Auth handlers ---

btnGoogle.addEventListener("click", async () => {
    try {
        cloudStatus.textContent = "Cloud: signing in…";
        await signInWithPopup(auth, googleProvider);
    } catch (err) {
        console.error(err);
        cloudStatus.textContent = "Cloud: sign-in error";
    }
});

btnEmail.addEventListener("click", () => {
    emailError.textContent = "";
    emailForm.reset();
    emailModal.style.display = "flex";
});

emailModalClose.addEventListener("click", () => {
    emailModal.style.display = "none";
});

emailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    emailError.textContent = "";
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        emailError.textContent = "Email and password required.";
        return;
    }

    try {
        cloudStatus.textContent = "Cloud: signing in…";
        // Try login first
        await signInWithEmailAndPassword(auth, email, password);
        emailModal.style.display = "none";
    } catch (err) {
        if (err.code === "auth/user-not-found") {
            // Create account
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                emailModal.style.display = "none";
            } catch (err2) {
                console.error(err2);
                emailError.textContent = "Could not create account.";
                cloudStatus.textContent = "Cloud: sign-up error";
            }
        } else {
            console.error(err);
            emailError.textContent = "Login failed. Check details.";
            cloudStatus.textContent = "Cloud: sign-in error";
        }
    }
});

btnLogout.addEventListener("click", async () => {
    try {
        cloudStatus.textContent = "Cloud: signing out…";
        await signOut(auth);
    } catch (err) {
        console.error(err);
        cloudStatus.textContent = "Cloud: sign-out error";
    }
});

// --- Auth state listener ---

onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    updateAuthUI(currentUser);

    if (currentUser) {
        await loadSessionsFromCloud(currentUser);
    } else {
        // Keep local sessions, but cloud is idle
        render();
    }
});

// --- Initial render ---
render();
