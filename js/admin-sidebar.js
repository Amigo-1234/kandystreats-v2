// admin-sidebar.js

import { getAuth, signOut } from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

// Firebase config (same one)
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

// -----------------------------
// ACTIVE LINK HIGHLIGHT
// -----------------------------
const currentPage = location.pathname.split("/").pop();

document.querySelectorAll(".sidebar-nav .nav-item").forEach(link => {
  const href = link.getAttribute("href");
  link.classList.toggle("is-active", href === currentPage);
});

// -----------------------------
// LOGOUT
// -----------------------------
document.querySelectorAll("[data-logout]").forEach(btn => {
  btn.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "/super-admin-login.html";
  });
});