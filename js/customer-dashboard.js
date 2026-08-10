import {
  auth,
  db,
  functions,
  COLLECTIONS,
  ORDER_STATUSES,
  formatDateTime,
  formatPrice,
  getOrderItems,
  serverTimestamp,
} from "./firebase-core.js";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  signOut,
  updatePassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import {
  CART_BASE_KEY,
  clearLegacyCustomerStorage,
  readJsonStorage,
  writeJsonStorage,
} from "./customer-storage.js";

const state = {
  user: null,
  profile: null,
  wallet: null,
  orders: [],
  transactions: [],
  addresses: [],
  favourites: [],
  reviews: [],
  notifications: [],
  menus: [],
  paymentConfig: null,
  unsubscribers: [],
};

const tabs = document.querySelectorAll("[data-account-tab]");
const panels = document.querySelectorAll("[data-account-panel]");
const toast = document.querySelector(".toast-container");
const verifyBanner = document.getElementById("email-verify-banner");
const loading = document.getElementById("account-loading");
const accountContent = document.getElementById("account-content");

function showToast(message, type = "success") {
  if (!toast) return;
  const node = document.createElement("div");
  node.className = `toast toast-${type}`;
  node.textContent = message;
  toast.innerHTML = "";
  toast.appendChild(node);
  window.setTimeout(() => node.remove(), 2600);
}

function walletFundingErrorMessage(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  if (message.includes("secret key") || message.includes("not configured") || code.includes("failed-precondition")) {
    return "Wallet funding needs server-side payment verification before it can credit your balance. Public keys alone are not enough for wallet funding.";
  }
  if (code.includes("internal") || message.includes("cors") || message.includes("failed to fetch")) {
    return "Wallet funding backend is not reachable yet. Public keys can open checkout, but wallet crediting still requires the secure backend.";
  }
  if (code.includes("unauthenticated")) return "Please sign in again before funding your wallet.";
  if (code.includes("invalid-argument")) return "Choose Paystack or Flutterwave and enter a valid amount.";
  if (code.includes("not-found") || message.includes("function")) {
    return "Wallet funding service is not deployed yet. Deploy the secure payment functions before accepting wallet top-ups.";
  }
  if (code.includes("unavailable") || message.includes("network")) {
    return "Payment service is temporarily unavailable. Please try again shortly.";
  }
  return "Could not start wallet funding. Please try again or contact support.";
}

function dashboardErrorMessage(error, fallback = "That action failed. Please try again.") {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  if (code.includes("unauthenticated")) return "Please sign in again to continue.";
  if (code.includes("invalid-argument")) return error?.message || "Please check the details and try again.";
  if (code.includes("permission-denied") || message.includes("insufficient permissions")) {
    return "Your account permission is not ready yet. Sign out and back in, then deploy the latest Firestore rules if this continues.";
  }
  if (code.includes("not-found") || message.includes("function")) {
    return "This dashboard service is not deployed yet. Deploy the latest Firebase functions and try again.";
  }
  if (code.includes("failed-precondition") || message.includes("index")) {
    return "Firebase setup needs the latest rules/indexes/functions deployed before this can work.";
  }
  if (code.includes("unavailable") || message.includes("network")) {
    return "Network or Firebase service is temporarily unavailable. Please try again shortly.";
  }

  return fallback;
}

function isCallableUnavailable(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return code.includes("not-found")
    || code.includes("unimplemented")
    || code.includes("internal")
    || message.includes("function")
    || message.includes("cors")
    || message.includes("failed to fetch")
    || message.includes("network request failed")
    || message.includes("not found");
}

function walletCallbackUrl(transactionId, provider) {
  const url = new URL("account.html", window.location.origin);
  url.searchParams.set("walletFunding", transactionId || "pending");
  url.searchParams.set("provider", provider);
  return url.href;
}

function cleanupWalletFundingQuery() {
  const url = new URL(window.location.href);
  [
    "walletFunding",
    "provider",
    "status",
    "reference",
    "trxref",
    "tx_ref",
    "transaction_id",
    "id",
  ].forEach((key) => url.searchParams.delete(key));
  history.replaceState(null, "", `${url.pathname}${url.search}#wallet`);
}

async function handleWalletFundingReturn() {
  const params = new URLSearchParams(window.location.search);
  const transactionId = params.get("walletFunding");
  const provider = params.get("provider");

  if (!transactionId || !provider || transactionId === "pending") return;

  showTab("wallet");
  showToast("Verifying wallet funding...", "info");

  try {
    const verifyWalletFundingPayment = httpsCallable(functions, "verifyWalletFundingPayment");
    const result = await verifyWalletFundingPayment({
      transactionId,
      provider,
      status: params.get("status") || "",
      reference: params.get("reference") || params.get("trxref") || params.get("tx_ref") || "",
      gatewayTransactionId: params.get("transaction_id") || params.get("id") || "",
    });

    const status = result.data?.status;
    if (status === "success" || status === "already_success") {
      showToast("Wallet funded successfully.");
    } else if (status === "cancelled" || status === "canceled") {
      showToast("Wallet funding was cancelled.", "error");
    } else {
      showToast("Wallet funding failed.", "error");
    }
  } catch (error) {
    console.error(error);
    showToast("Could not verify wallet funding.", "error");
  } finally {
    cleanupWalletFundingQuery();
  }
}

function setLoading(isLoading) {
  if (loading) loading.hidden = !isLoading;
  if (accountContent) accountContent.hidden = isLoading;
}

function showTab(name) {
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.accountTab === name));
  panels.forEach((panel) => {
    panel.hidden = panel.dataset.accountPanel !== name;
  });
  history.replaceState(null, "", `#${name}`);
}

function emptyState(text, action = "") {
  return `
    <div class="empty-state-card">
      <p>${text}</p>
      ${action}
    </div>
  `;
}

function skeletonRows(count = 3) {
  return Array.from({ length: count }, () => `<div class="dash-skeleton"></div>`).join("");
}

function dateValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function newestFirst(items) {
  return items.sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
}

function cleanupListeners() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
}

async function ensureDashboardAccount(user) {
  const profile = {
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || "",
  };

  try {
    const ensureCustomerAccount = httpsCallable(functions, "ensureCustomerAccount");
    await ensureCustomerAccount({ profile });
    return true;
  } catch (error) {
    console.warn("Cloud account setup unavailable; trying dashboard fallback.", error);
  }

  try {
    const userRef = doc(db, COLLECTIONS.users, user.uid);
    const walletRef = doc(db, COLLECTIONS.wallets, user.uid);
    const walletSnap = await getDoc(walletRef);

    await setDoc(
      userRef,
      {
        uid: user.uid,
        role: "customer",
        email: user.email || "",
        displayName: user.displayName || "",
        phone: state.profile?.phone || "",
        photoURL: user.photoURL || "",
        emailVerified: user.emailVerified,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    if (!walletSnap.exists()) {
      await setDoc(walletRef, {
        userId: user.uid,
        currency: "NGN",
        balance: 0,
        availableBalance: 0,
        lockedBalance: 0,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return true;
  } catch (error) {
    console.error("Dashboard account setup failed.", error);
    showToast(dashboardErrorMessage(error, "Could not prepare your account. Please sign out and sign in again."), "error");
    return false;
  }
}

async function getPaymentConfig(provider) {
  try {
    const getPaymentConfigurationStatus = httpsCallable(functions, "getPaymentConfigurationStatus");
    const result = await getPaymentConfigurationStatus();
    state.paymentConfig = result.data || null;
    return result.data?.[provider];
  } catch (error) {
    console.warn("Payment configuration check unavailable.", error);
    state.paymentConfig = null;
    return null;
  }
}

async function refreshPaymentStatus() {
  const statusEl = document.getElementById("wallet-fund-status");
  if (!statusEl) return;

  try {
    const getPaymentConfigurationStatus = httpsCallable(functions, "getPaymentConfigurationStatus");
    const result = await getPaymentConfigurationStatus();
    const config = result.data || {};
    state.paymentConfig = config;
    const missing = [
      config.paystack ? "" : "Paystack",
      config.flutterwave ? "" : "Flutterwave",
    ].filter(Boolean);

    statusEl.textContent = missing.length
      ? `${missing.join(" and ")} setup is missing in Firebase. Funding will work after the secret keys are deployed.`
      : "";
  } catch (error) {
    console.warn("Payment setup status check failed.", error);
    statusEl.textContent = isCallableUnavailable(error)
      ? "Deploy the latest Firebase functions to enable wallet funding."
      : "";
  }
}

function addressFormData(form, isDefault = false) {
  return {
    label: form.label.value.trim() || "Delivery address",
    recipientName: form.recipientName.value.trim() || state.profile?.displayName || state.user?.displayName || "",
    phone: form.phone.value.trim() || state.profile?.phone || "",
    address: form.address.value.trim(),
    notes: form.notes.value.trim(),
    isDefault,
  };
}

async function saveAddress(address) {
  try {
    const saveCustomerAddress = httpsCallable(functions, "saveCustomerAddress");
    await saveCustomerAddress({ address });
    return;
  } catch (error) {
    if (!isCallableUnavailable(error)) throw error;
    console.warn("Address callable unavailable; trying Firestore rules fallback.", error);
  }

  await addDoc(collection(db, COLLECTIONS.addresses), {
    userId: state.user.uid,
    ...address,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function deleteAddress(addressId) {
  try {
    const deleteCustomerAddress = httpsCallable(functions, "deleteCustomerAddress");
    await deleteCustomerAddress({ addressId });
    return;
  } catch (error) {
    if (!isCallableUnavailable(error)) throw error;
    console.warn("Delete address callable unavailable; trying Firestore rules fallback.", error);
  }

  const deleted = state.addresses.find((address) => address.id === addressId);
  const fallback = state.addresses.find((address) => address.id !== addressId);
  await deleteDoc(doc(db, COLLECTIONS.addresses, addressId));
  if (deleted?.isDefault && fallback) {
    await updateDoc(doc(db, COLLECTIONS.addresses, fallback.id), {
      isDefault: true,
      updatedAt: serverTimestamp(),
    });
  }
}

async function setDefaultAddress(addressId) {
  try {
    const setDefaultCustomerAddress = httpsCallable(functions, "setDefaultCustomerAddress");
    await setDefaultCustomerAddress({ addressId });
    return;
  } catch (error) {
    if (!isCallableUnavailable(error)) throw error;
    console.warn("Default address callable unavailable; trying Firestore rules fallback.", error);
  }

  await Promise.all(state.addresses.map((address) => updateDoc(doc(db, COLLECTIONS.addresses, address.id), {
    isDefault: address.id === addressId,
    updatedAt: serverTimestamp(),
  })));
}

function bindSnapshot(refOrQuery, handler) {
  const unsubscribe = onSnapshot(refOrQuery, handler, (error) => {
    console.error(error);
    showToast(dashboardErrorMessage(error, "Failed to load one dashboard section."), "error");
  });
  state.unsubscribers.push(unsubscribe);
}

function updateShell() {
  const name = state.profile?.displayName || state.user?.displayName || "Customer";
  const email = state.user?.email || state.profile?.email || "-";
  const walletBalance = state.wallet?.balance || 0;
  const currentOrders = state.orders.filter((order) => !["Completed", "Cancelled"].includes(order.status)).length;
  const completedOrders = state.orders.filter((order) => order.status === "Completed").length;

  document.querySelectorAll("[data-user-name]").forEach((el) => {
    el.textContent = name;
  });
  document.querySelectorAll("[data-user-email]").forEach((el) => {
    el.textContent = email;
  });
  document.querySelectorAll("[data-wallet-balance]").forEach((el) => {
    el.textContent = formatPrice(walletBalance);
  });
  document.querySelectorAll("[data-current-orders]").forEach((el) => {
    el.textContent = currentOrders;
  });
  document.querySelectorAll("[data-completed-orders]").forEach((el) => {
    el.textContent = completedOrders;
  });
  document.querySelectorAll("[data-favourite-count]").forEach((el) => {
    el.textContent = state.favourites.length;
  });

  if (verifyBanner) {
    verifyBanner.hidden = Boolean(state.user?.emailVerified);
  }
}

function statusIndex(status) {
  return Math.max(0, ORDER_STATUSES.indexOf(status || "New"));
}

function renderOrders() {
  const allWraps = document.querySelectorAll('[data-orders-list="all"]');
  const currentWraps = document.querySelectorAll('[data-orders-list="current"]');
  const completedWraps = document.querySelectorAll('[data-orders-list="completed"]');
  if (!allWraps.length && !currentWraps.length && !completedWraps.length) return;

  const renderList = (orders, emptyText) => {
    if (!orders.length) return emptyState(emptyText, `<a class="btn btn-primary btn-sm" href="menu.html">Order now</a>`);

    return orders.map((order) => {
      const items = getOrderItems(order);
      const step = statusIndex(order.status);
      const receiptId = `receipt-${order.id}`;
      return `
        <article class="dashboard-list-card" data-order-id="${order.id}">
          <div class="dash-card-top">
            <div>
              <span class="eyebrow">Order</span>
              <h3>${order.id}</h3>
              <p>${formatDateTime(order.createdAt)}</p>
            </div>
            <span class="status-pill status-${String(order.status || "New").toLowerCase()}">${order.status || "New"}</span>
          </div>
          <div class="dashboard-progress" aria-label="Order progress">
            ${ORDER_STATUSES.map((status, index) => `
              <span class="${index <= step ? "is-done" : ""}" title="${status}"></span>
            `).join("")}
          </div>
          <ul class="mini-list">
            ${items.slice(0, 4).map((item) => `<li>${item.qty || 1} x ${item.name}</li>`).join("")}
            ${items.length > 4 ? `<li>${items.length - 4} more item(s)</li>` : ""}
          </ul>
          <div class="dash-card-actions">
            <strong>${formatPrice(order.total)}</strong>
            <button class="btn btn-outline btn-sm" data-reorder="${order.id}">Reorder</button>
            <a class="btn btn-outline btn-sm" href="track.html?code=${order.id}">Track</a>
            <button class="btn btn-ghost btn-sm" data-toggle-receipt="${receiptId}">Receipt</button>
          </div>
          <div id="${receiptId}" class="receipt-panel" hidden>
            <div class="receipt-line"><span>Subtotal</span><strong>${formatPrice(order.subtotal)}</strong></div>
            <div class="receipt-line"><span>Delivery</span><strong>${formatPrice(order.deliveryFee)}</strong></div>
            <div class="receipt-line"><span>Takeaway</span><strong>${formatPrice(order.takeawayFee)}</strong></div>
            <div class="receipt-line"><span>Discount</span><strong>-${formatPrice(order.discount)}</strong></div>
            <div class="receipt-line"><span>Total paid</span><strong>${formatPrice(order.total)}</strong></div>
            <div class="receipt-line"><span>Payment</span><strong>${order.paymentProvider || "Pending"}</strong></div>
          </div>
        </article>
      `;
    }).join("");
  };

  const current = state.orders.filter((order) => !["Completed", "Cancelled"].includes(order.status));
  const completed = state.orders.filter((order) => order.status === "Completed");

  allWraps.forEach((wrap) => {
    wrap.innerHTML = renderList(state.orders, "No orders yet.");
  });
  currentWraps.forEach((wrap) => {
    wrap.innerHTML = renderList(current, "You do not have a live order right now.");
  });
  completedWraps.forEach((wrap) => {
    wrap.innerHTML = renderList(completed, "No completed orders yet.");
  });
}

function renderWallet() {
  const transactionWrap = document.getElementById("transaction-list");
  if (!transactionWrap) return;

  if (!state.transactions.length) {
    transactionWrap.innerHTML = emptyState("No wallet transactions yet.");
    return;
  }

  transactionWrap.innerHTML = state.transactions.map((tx) => `
    <article class="dashboard-list-card transaction-card">
      <div>
        <strong>${tx.title || tx.type || "Transaction"}</strong>
        <p>${formatDateTime(tx.createdAt)}</p>
      </div>
      <div class="transaction-right">
        <span class="status-pill status-${tx.status || "pending"}">${tx.status || "pending"}</span>
        <strong>${tx.direction === "debit" ? "-" : "+"}${formatPrice(tx.amount)}</strong>
      </div>
    </article>
  `).join("");
}

function renderAddresses() {
  const wrap = document.getElementById("addresses-list");
  const select = document.getElementById("default-address-select");
  if (!wrap) return;

  if (select) {
    select.innerHTML = `<option value="">No default address</option>`;
    state.addresses.forEach((address) => {
      const option = document.createElement("option");
      option.value = address.id;
      option.textContent = `${address.label || "Address"} - ${address.address}`;
      option.selected = Boolean(address.isDefault);
      select.appendChild(option);
    });
  }

  if (!state.addresses.length) {
    wrap.innerHTML = emptyState("You have not saved a delivery address yet.");
    return;
  }

  wrap.innerHTML = state.addresses.map((address) => `
    <article class="dashboard-list-card">
      <div>
        <strong>${address.label || "Delivery address"}</strong>
        <p>${address.address}</p>
        <span>${address.phone || state.profile?.phone || ""}</span>
      </div>
      <div class="dash-card-actions">
        ${address.isDefault ? `<span class="status-pill status-success">Default</span>` : `<button class="btn btn-outline btn-sm" data-default-address="${address.id}">Default</button>`}
        <button class="btn btn-ghost btn-sm" data-delete-address="${address.id}">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderFavourites() {
  const wrap = document.getElementById("favourites-list");
  if (!wrap) return;

  if (!state.favourites.length) {
    wrap.innerHTML = emptyState("No favourite meals saved yet.", `<a class="btn btn-primary btn-sm" href="menu.html">Browse menu</a>`);
    return;
  }

  wrap.innerHTML = state.favourites.map((fav) => {
    const meal = fav.meal || {};
    return `
      <article class="dashboard-list-card favourite-card">
        <div>
          <strong>${meal.name || fav.menuName || "Meal"}</strong>
          <p>${meal.category || "Saved meal"}</p>
          <span>${formatPrice(meal.price)}</span>
        </div>
        <div class="dash-card-actions">
          <button class="btn btn-primary btn-sm" data-reorder-favourite="${fav.id}">Add to cart</button>
          <button class="btn btn-ghost btn-sm" data-delete-favourite="${fav.id}">Remove</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderReviews() {
  const wrap = document.getElementById("reviews-list");
  const menuSelect = document.getElementById("review-menu");
  if (!wrap) return;

  if (menuSelect && !menuSelect.dataset.ready) {
    menuSelect.innerHTML = `<option value="">Select a meal</option>`;
    state.menus.forEach((meal) => {
      const option = document.createElement("option");
      option.value = meal.id;
      option.textContent = meal.name;
      option.dataset.name = meal.name;
      menuSelect.appendChild(option);
    });
    menuSelect.dataset.ready = "1";
  }

  if (!state.reviews.length) {
    wrap.innerHTML = emptyState("You have not reviewed a meal yet.");
    return;
  }

  wrap.innerHTML = state.reviews.map((review) => `
    <article class="dashboard-list-card">
      <div>
        <strong>${review.menuName || "Meal review"}</strong>
        <p>${"&#9733;".repeat(Number(review.rating || 0))}${"&#9734;".repeat(5 - Number(review.rating || 0))}</p>
        <span>${review.comment || ""}</span>
      </div>
      <div class="dash-card-actions">
        <button class="btn btn-outline btn-sm" data-edit-review="${review.id}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-delete-review="${review.id}">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderNotifications() {
  const wraps = document.querySelectorAll("[data-notifications-list]");
  const unread = state.notifications.filter((item) => !item.read).length;
  document.querySelectorAll("[data-notification-count]").forEach((el) => {
    el.textContent = unread;
    el.hidden = unread === 0;
  });

  if (!wraps.length) return;
  if (!state.notifications.length) {
    wraps.forEach((wrap) => {
      wrap.innerHTML = emptyState("No notifications yet.");
    });
    return;
  }

  const html = state.notifications.map((item) => `
    <article class="dashboard-list-card notification-card ${item.read ? "" : "is-unread"}">
      <div>
        <strong>${item.title || "Notification"}</strong>
        <p>${item.message || ""}</p>
        <span>${formatDateTime(item.createdAt)}</span>
      </div>
      ${item.read ? "" : `<button class="btn btn-outline btn-sm" data-read-notification="${item.id}">Mark read</button>`}
    </article>
  `).join("");

  wraps.forEach((wrap) => {
    wrap.innerHTML = html;
  });
}

function renderAll() {
  updateShell();
  renderOrders();
  renderWallet();
  renderAddresses();
  renderFavourites();
  renderReviews();
  renderNotifications();
}

function setupRealtime(user) {
  cleanupListeners();

  bindSnapshot(doc(db, COLLECTIONS.users, user.uid), (snap) => {
    state.profile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    fillProfileForms();
    renderAll();
  });

  bindSnapshot(doc(db, COLLECTIONS.wallets, user.uid), (snap) => {
    state.wallet = snap.exists() ? { id: snap.id, ...snap.data() } : { balance: 0 };
    renderAll();
  });

  bindSnapshot(
    query(collection(db, COLLECTIONS.orders), where("userId", "==", user.uid)),
    (snap) => {
      state.orders = newestFirst(snap.docs.map((item) => ({ id: item.id, ...item.data() }))).slice(0, 50);
      renderAll();
    },
  );

  bindSnapshot(
    query(collection(db, COLLECTIONS.transactions), where("userId", "==", user.uid)),
    (snap) => {
      state.transactions = newestFirst(snap.docs.map((item) => ({ id: item.id, ...item.data() }))).slice(0, 50);
      renderAll();
    },
  );

  bindSnapshot(
    query(collection(db, COLLECTIONS.addresses), where("userId", "==", user.uid)),
    (snap) => {
      state.addresses = newestFirst(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      renderAll();
    },
  );

  bindSnapshot(
    query(collection(db, COLLECTIONS.favourites), where("userId", "==", user.uid)),
    (snap) => {
      state.favourites = newestFirst(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      renderAll();
    },
  );

  bindSnapshot(
    query(collection(db, COLLECTIONS.reviews), where("userId", "==", user.uid)),
    (snap) => {
      state.reviews = newestFirst(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
      renderAll();
    },
  );

  bindSnapshot(
    query(collection(db, COLLECTIONS.notifications), where("userId", "==", user.uid)),
    (snap) => {
      state.notifications = newestFirst(snap.docs.map((item) => ({ id: item.id, ...item.data() }))).slice(0, 50);
      renderAll();
    },
  );
}

async function loadMenus() {
  const menuSnap = await getDocs(query(collection(db, "menus"), orderBy("createdAt", "asc")));
  state.menus = menuSnap.docs.map((item) => ({
    id: item.id,
    name: item.data().name,
    price: item.data().price,
    category: item.data().section,
    image: item.data().image,
  }));
  const menuSelect = document.getElementById("review-menu");
  if (menuSelect) menuSelect.dataset.ready = "";
  renderReviews();
}

function fillProfileForms() {
  const profileForm = document.getElementById("profile-form");
  if (!profileForm || !state.user) return;
  profileForm.displayName.value = state.profile?.displayName || state.user.displayName || "";
  profileForm.phone.value = state.profile?.phone || "";
  profileForm.email.value = state.user.email || "";
}

function addItemsToCart(items) {
  const uid = state.user?.uid || null;
  const cart = readJsonStorage(CART_BASE_KEY, uid, {});

  items.forEach((item) => {
    const id = item.id || item.menuId || item.name;
    cart[id] = {
      id,
      name: item.name,
      price: Number(item.price || 0),
      qty: (cart[id]?.qty || 0) + Number(item.qty || 1),
    };
  });

  writeJsonStorage(CART_BASE_KEY, uid, cart);
  window.dispatchEvent(new CustomEvent("kandys:cart-change", {
    detail: { uid },
  }));
  window.location.href = "cart.html";
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showTab(tab.dataset.accountTab));
});

document.getElementById("logout-btn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "auth.html";
});

document.getElementById("resend-verification")?.addEventListener("click", async () => {
  if (!state.user) return;
  await sendEmailVerification(state.user);
  showToast("Verification email sent.");
});

document.getElementById("profile-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const displayName = form.displayName.value.trim();
  const phone = form.phone.value.trim();

  await updateProfile(state.user, { displayName });
  await setDoc(
    doc(db, COLLECTIONS.users, state.user.uid),
    {
      displayName,
      phone,
      email: state.user.email,
      emailVerified: state.user.emailVerified,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  showToast("Profile updated.");
});

document.getElementById("password-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const currentPassword = form.currentPassword.value;
  const newPassword = form.newPassword.value;
  const confirmPassword = form.confirmPassword.value;

  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match.", "error");
    return;
  }

  try {
    const credential = EmailAuthProvider.credential(state.user.email, currentPassword);
    await reauthenticateWithCredential(state.user, credential);
    await updatePassword(state.user, newPassword);
    form.reset();
    showToast("Password changed.");
  } catch (error) {
    showToast(error.code?.includes("wrong-password") ? "Current password is incorrect." : "Could not change password.", "error");
  }
});

document.getElementById("wallet-fund-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const statusEl = document.getElementById("wallet-fund-status");
  const amount = Number(form.amount.value);
  const provider = form.provider.value;
  const allowedProviders = new Set(["paystack", "flutterwave"]);

  if (!amount || amount < 100) {
    showToast("Enter at least NGN 100.", "error");
    return;
  }
  if (!allowedProviders.has(provider)) {
    showToast("Choose Paystack or Flutterwave.", "error");
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (statusEl) statusEl.textContent = "Checking payment setup...";
  try {
    const providerConfigured = state.paymentConfig?.[provider] ?? await getPaymentConfig(provider);
    if (providerConfigured === false) {
      throw Object.assign(new Error(`${provider === "paystack" ? "Paystack" : "Flutterwave"} is not configured yet.`), {
        code: "failed-precondition",
      });
    }

    if (statusEl) statusEl.textContent = "Starting secure wallet funding...";
    const createWalletFundingPayment = httpsCallable(functions, "createWalletFundingPayment");
    const result = await createWalletFundingPayment({
      amount,
      provider,
      callbackUrl: walletCallbackUrl("pending", provider),
    });

    const authorizationUrl = result.data?.authorizationUrl;
    if (!authorizationUrl) {
      throw new Error("Gateway did not return a checkout link.");
    }

    window.location.href = authorizationUrl;
  } catch (error) {
    console.error(error);
    const message = walletFundingErrorMessage(error);
    if (statusEl) statusEl.textContent = message;
    showToast(message, "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (state.paymentConfig && statusEl && !statusEl.textContent.includes("secret")) {
      refreshPaymentStatus();
    }
  }
});

document.getElementById("address-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const statusEl = document.getElementById("address-form-status");
  const isFirstAddress = state.addresses.length === 0;
  const address = addressFormData(form, isFirstAddress);

  if (!address.address || address.address.length < 8) {
    const message = "Enter a complete delivery address.";
    if (statusEl) statusEl.textContent = message;
    showToast(message, "error");
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (statusEl) statusEl.textContent = "Saving address...";

  try {
    await saveAddress(address);
    form.reset();
    if (statusEl) statusEl.textContent = "Address saved.";
    showToast("Address saved.");
  } catch (error) {
    console.error(error);
    const message = dashboardErrorMessage(error, "Could not save address. Please try again.");
    if (statusEl) statusEl.textContent = message;
    showToast(message, "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

document.getElementById("review-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const menuId = form.menuId.value;
  const selected = form.menuId.selectedOptions[0];
  const menuName = selected?.dataset.name || selected?.textContent || "Meal";
  const rating = Number(form.rating.value);
  const comment = form.comment.value.trim();

  if (!menuId || !rating) {
    showToast("Choose a meal and rating.", "error");
    return;
  }

  await setDoc(
    doc(db, COLLECTIONS.reviews, `${state.user.uid}_${menuId}`),
    {
      userId: state.user.uid,
      menuId,
      menuName,
      rating,
      comment,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );

  form.reset();
  form.dataset.editing = "";
  showToast("Review saved.");
});

document.getElementById("support-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;

  await addDoc(collection(db, COLLECTIONS.supportTickets), {
    userId: state.user.uid,
    name: state.profile?.displayName || state.user.displayName || "",
    email: state.user.email,
    subject: form.subject.value.trim(),
    message: form.message.value.trim(),
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  form.reset();
  showToast("Support request sent.");
});

document.getElementById("mark-all-read")?.addEventListener("click", async () => {
  const unread = state.notifications.filter((item) => !item.read);
  await Promise.all(unread.map((item) => updateDoc(doc(db, COLLECTIONS.notifications, item.id), {
    read: true,
    readAt: serverTimestamp(),
  })));
  showToast("Notifications marked as read.");
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-reorder], [data-toggle-receipt], [data-delete-address], [data-default-address], [data-delete-favourite], [data-reorder-favourite], [data-edit-review], [data-delete-review], [data-read-notification]");
  if (!target) return;

  try {
  if (target.dataset.reorder) {
    const order = state.orders.find((item) => item.id === target.dataset.reorder);
    addItemsToCart(getOrderItems(order));
  }

  if (target.dataset.toggleReceipt) {
    const panel = document.getElementById(target.dataset.toggleReceipt);
    if (panel) panel.hidden = !panel.hidden;
  }

  if (target.dataset.deleteAddress) {
    await deleteAddress(target.dataset.deleteAddress);
    showToast("Address deleted.");
  }

  if (target.dataset.defaultAddress) {
    await setDefaultAddress(target.dataset.defaultAddress);
    showToast("Default address updated.");
  }

  if (target.dataset.deleteFavourite) {
    await deleteDoc(doc(db, COLLECTIONS.favourites, target.dataset.deleteFavourite));
    showToast("Favourite removed.");
  }

  if (target.dataset.reorderFavourite) {
    const fav = state.favourites.find((item) => item.id === target.dataset.reorderFavourite);
    if (fav?.meal) addItemsToCart([{ ...fav.meal, qty: 1, id: fav.meal.id || fav.menuId }]);
  }

  if (target.dataset.editReview) {
    const review = state.reviews.find((item) => item.id === target.dataset.editReview);
    const form = document.getElementById("review-form");
    if (review && form) {
      form.menuId.value = review.menuId;
      form.rating.value = review.rating;
      form.comment.value = review.comment || "";
      showTab("reviews");
    }
  }

  if (target.dataset.deleteReview) {
    await deleteDoc(doc(db, COLLECTIONS.reviews, target.dataset.deleteReview));
    showToast("Review deleted.");
  }

  if (target.dataset.readNotification) {
    await updateDoc(doc(db, COLLECTIONS.notifications, target.dataset.readNotification), {
      read: true,
      readAt: serverTimestamp(),
    });
  }
  } catch (error) {
    console.error(error);
    showToast(dashboardErrorMessage(error), "error");
  }
});

document.getElementById("default-address-select")?.addEventListener("change", async (event) => {
  const id = event.target.value;
  try {
    if (!id) return;
    await setDefaultAddress(id);
    showToast("Default address updated.");
  } catch (error) {
    console.error(error);
    showToast(dashboardErrorMessage(error, "Could not update default address."), "error");
  }
});

document.getElementById("quick-order-btn")?.addEventListener("click", () => {
  window.location.href = "menu.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = `auth.html?next=${encodeURIComponent("account.html")}`;
    return;
  }

  state.user = user;
  clearLegacyCustomerStorage();
  window.dispatchEvent(new CustomEvent("kandys:account-storage-change", {
    detail: { uid: user.uid },
  }));
  await ensureDashboardAccount(user);
  setLoading(false);
  setupRealtime(user);
  refreshPaymentStatus();
  await loadMenus();
  await handleWalletFundingReturn();
});

setLoading(true);
document.querySelector('[data-orders-list="all"]')?.insertAdjacentHTML("beforeend", skeletonRows());

const initialTab = window.location.hash?.replace("#", "") || "overview";
showTab(initialTab);
