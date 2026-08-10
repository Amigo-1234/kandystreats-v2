// admin-login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ================= FIREBASE ================= */

const firebaseConfig = {
  apiKey: "AIzaSyCWDTVJgW5dqcBbnZRb6m_Yz-fB7flO9nU",
  authDomain: "kandystreat-840b1.firebaseapp.com",
  projectId: "kandystreat-840b1",
  storageBucket: "kandystreat-840b1.firebasestorage.app",
  messagingSenderId: "394965571986",
  appId: "1:394965571986:web:ce79a02096c2eb2f2b094b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= ELEMENTS ================= */

const form = document.getElementById("admin-login-form");
const emailInput = document.getElementById("admin-email");
const passwordInput = document.getElementById("admin-password");

/* ================= HELPERS ================= */

function showError(msg) {
  alert(msg); // later we can replace with toast
}

function hasAdminAccess(role) {
  return ["staff", "admin", "superAdmin", "super-admin", "owner"].includes(role);
}

/* ================= AUTH FLOW ================= */

// If already logged in → go straight to admin
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await auth.signOut();
      return;
    }

    const { role } = snap.data();

    if (hasAdminAccess(role)) {
      window.location.href = "admin.html";
    } else {
      await auth.signOut();
    }
  } catch {
    await auth.signOut();
  }
});

/* ================= LOGIN ================= */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError("Please enter email and password");
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Role check
    const ref = doc(db, "users", cred.user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      showError("No admin role assigned");
      await auth.signOut();
      return;
    }

    const { role } = snap.data();

    if (!hasAdminAccess(role)) {
      showError("Access denied");
      await auth.signOut();
      return;
    }

    // ✅ SUCCESS
    window.location.href = "admin.html";

  } catch (err) {
    showError(err.message || "Login failed");
  }
});
