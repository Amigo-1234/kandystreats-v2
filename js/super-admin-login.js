import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

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

/* ================= ELEMENTS ================= */

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

/* ================= LOGIN ================= */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );

    window.location.href = "dashboard.html";
  } catch (err) {
    alert("Invalid login credentials");
  }
});

/* ================= AUTO REDIRECT ================= */

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "dashboard.html";
  }
});