import { auth } from "./firebase-core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  CART_BASE_KEY,
  clearLegacyCustomerStorage,
  readJsonStorage,
} from "./customer-storage.js";

let currentUser = null;

const ACCOUNT_ICON = `
  <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"/>
  </svg>
`;

function ensureAccountNav() {
  const nav = document.querySelector(".bottom-nav");
  if (!nav || nav.querySelector('[data-page="account"]')) return;

  const account = document.createElement("a");
  account.href = "account.html";
  account.className = "bottom-nav-item";
  account.dataset.page = "account";
  account.innerHTML = `
    ${ACCOUNT_ICON}
    <span class="nav-label" data-auth-nav-label>Account</span>
  `;

  nav.appendChild(account);
}

function setActiveNav() {
  const page = document.documentElement.dataset.page;
  document.querySelectorAll(".bottom-nav-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.page === page);
  });
}

function syncCartBadge() {
  const cart = readJsonStorage(CART_BASE_KEY, currentUser?.uid || null, {});

  const totalQty = Object.values(cart).reduce((sum, item) => sum + Number(item.qty || 0), 0);
  document.querySelectorAll(".js-cart-count").forEach((badge) => {
    badge.textContent = totalQty;
    badge.style.opacity = totalQty > 0 ? "1" : "0";
  });
}

ensureAccountNav();
setActiveNav();
syncCartBadge();

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  clearLegacyCustomerStorage();
  document.querySelectorAll("[data-auth-nav-label]").forEach((label) => {
    label.textContent = user ? "Account" : "Login";
  });
  syncCartBadge();
});

window.addEventListener("kandys:cart-change", syncCartBadge);
window.addEventListener("kandys:account-storage-change", (event) => {
  if (event.detail && "uid" in event.detail) {
    currentUser = event.detail.uid ? { uid: event.detail.uid } : null;
  }
  syncCartBadge();
});
window.addEventListener("storage", (event) => {
  if (event.key?.startsWith(`${CART_BASE_KEY}_`)) syncCartBadge();
});
