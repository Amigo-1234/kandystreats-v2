// ===============================
// ADMIN.JS — Kandys Treats (UI-SYNCED)
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  getDocs,          // ✅ ADD THIS
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";

import { writeBatch } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ===============================i
   FIREBASE
================================ */
const firebaseConfig = {
  apiKey: "AIzaSyCWDTVJgW5dqcBbnZRb6m_Yz-fB7flO9nU",
  authDomain: "kandystreat-840b1.firebaseapp.com",
  projectId: "kandystreat-840b1",
  storageBucket: "kandystreat-840b1.firebasestorage.app",
  messagingSenderId: "394965571986",
  appId: "1:394965571986:web:ce79a02096c2eb2f2b094b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);

/* ===============================
   DOM
================================ */
const tbody = document.getElementById("orders-tbody");
const searchInput = document.getElementById("order-search");
const filters = document.getElementById("status-filters");
const logoutBtn = document.getElementById("admin-logout");
const soundBtn = document.getElementById("toggle-sound");
const printBtn = document.getElementById("print-receipt");

const statTotal = document.getElementById("stat-total");
const statNew = document.getElementById("stat-new");
const statPreparing = document.getElementById("stat-preparing");
const statCompleted = document.getElementById("stat-completed");
const statRevenue = document.getElementById("stat-revenue");

const detailPanel = document.getElementById("order-detail-panel");
const detailEmpty = document.getElementById("order-detail-empty");
const detailContent = document.getElementById("order-detail-content");

const liveBtn = document.getElementById("toggle-live");
const liveText = document.getElementById("live-text");

const enableNotifBtn = document.getElementById("enable-notifications");

/* ===============================
   STATE
================================ */
const STATE = {
  orders: [],
  selectedId: null,
  filter: "All",
  search: "",
  dateRange: "today",
  soundOn: true,
  unsubscribe: null,

  acknowledged: new Set(),

  initialized: false
};

const ACK_KEY = "admin_acknowledged_orders";

STATE.acknowledged = new Set(
  JSON.parse(localStorage.getItem(ACK_KEY) || "[]")
);

function acknowledge(id) {
  STATE.acknowledged.add(id);
  localStorage.setItem(ACK_KEY, JSON.stringify([...STATE.acknowledged]));
}

/* ===============================
   SOUND ENGINE
================================ */
const alertAudio = new Audio("/sounds/order-alert.mp3");
alertAudio.loop = true;
alertAudio.volume = 0.9;

const SOUND = {
  playing: false,
};

function startAlertSound() {
  if (!STATE.soundOn || SOUND.playing) return;

  alertAudio.play()
    .then(() => {
      SOUND.playing = true;
      console.log("🔔 Order alert sound started");
    })
    .catch(() => {});
}

function stopAlertSound() {
  if (!SOUND.playing) return;

  alertAudio.pause();
  alertAudio.currentTime = 0;
  SOUND.playing = false;
  console.log("🔕 Order alert sound stopped");
}

/* ===============================
   HELPERS
================================ */
const formatPrice = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG")}`;

const toStatusClass = (s) =>
  String(s || "New").toLowerCase();

const isToday = (ts) => {
  if (!ts) return false;
  const d = ts.toDate();
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
};

function normalizePhone(phone) {
  if (!phone) return "";
  let p = phone.replace(/[^\d]/g, "");
  if (p.length === 11 && p.startsWith("0")) return "234" + p.slice(1);
  if (p.startsWith("234")) return p;
  return p;
}

function getUnacknowledgedNewOrders() {
  return STATE.orders.filter(o =>
    o.status === "New" &&
    !STATE.acknowledged.has(o.id)
  );
}

/* ===============================
   AUTH
================================ */
onAuthStateChanged(auth, async (user) => {
  if (!user) return location.href = "admin-login.html";

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    return location.href = "admin-login.html";
  }

  const { role } = snap.data();
  if (!["staff", "admin", "superAdmin", "super-admin", "owner"].includes(role)) {
    await signOut(auth);
    return location.href = "admin-login.html";
  }

  startOrdersListener();
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "admin-login.html";
});

const storeRef = doc(db, "settings", "store");

onSnapshot(storeRef, snap => {
  if (!snap.exists()) return;

  const { isLive } = snap.data();

  liveText.textContent = isLive ? "Live" : "Offline";
  liveBtn.classList.toggle("offline", !isLive);
});

async function setAllMenuStatus(status) {
  const q = query(collection(db, "menus"));
  const snap = await getDocs(q);

  const batch = writeBatch(db);

  snap.docs.forEach(docSnap => {
    batch.update(docSnap.ref, {
      status,
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
}

liveBtn?.addEventListener("click", async () => {
  const snap = await getDoc(storeRef);
  const isLive = snap.data()?.isLive ?? true;

  const next = !isLive;

  await setDoc(
  storeRef,
  {
    isLive: next,
    updatedAt: serverTimestamp()
  },
  { merge: true }
);

  // Sync menu availability
  await setAllMenuStatus(next ? "available" : "sold-out");
});

/* ===============================
   ORDERS LISTENER
================================ */
function startOrdersListener() {
  if (STATE.unsubscribe) return;

  const q = query(
  collection(db, "orders"),
  where("paid", "==", true),
  orderBy("createdAt", "desc")
);


STATE.unsubscribe = onSnapshot(q, (snap) => {

  if (!STATE.initialized) {

    STATE.orders = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    STATE.initialized = true;

    renderTable();
    updateStats();
    return;
  }

  snap.docChanges().forEach(change => {

    if (change.type === "added") {

      const order = change.doc.data();
      const orderId = change.doc.id;

      if (!order.paid) return;
      if (STATE.acknowledged.has(orderId)) return;

      new Notification("New Order Received 🛍", {
        body: `Order #${orderId} worth NGN ${order.total}`,
        icon: "logo.png"
      });

    }

  });

  STATE.orders = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  renderTable();
  updateStats();

});

}





/* ===============================
   FILTERS
================================ */
filters?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;

  STATE.filter = btn.dataset.filter;
  [...filters.children].forEach(b =>
    b.classList.toggle("is-active", b === btn)
  );
  renderTable();
});

searchInput?.addEventListener("input", e => {
  STATE.search = e.target.value.toLowerCase();
  renderTable();
});

/* ===============================
   TABLE
================================ */
function getVisibleOrders() {
  let list = [...STATE.orders];
  list = list.filter(inDateRange);

  if (STATE.filter !== "All") {
    list = list.filter(o => (o.status || "New") === STATE.filter);
  }

  if (STATE.search) {
    list = list.filter(o =>
      o.id.toLowerCase().includes(STATE.search) ||
      o.customer?.name?.toLowerCase().includes(STATE.search) ||
      o.customer?.phone?.includes(STATE.search)
    );
  }

  return list;
}

function renderTable() {
  tbody.innerHTML = "";
  const list = getVisibleOrders();

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6">No orders</td></tr>`;
    return;
  }

  list.forEach(order => {
    const tr = document.createElement("tr");
    tr.dataset.id = order.id;

    tr.innerHTML = `
      <td>${order.id}</td>
      <td>${order.createdAt.toDate().toLocaleString("en-NG")}</td>
      <td>${order.customer?.name || "-"}</td>
      <td>${formatPrice(order.total)}</td>
      <td>${order.fulfilment === "delivery" ? "Delivery" : "Pickup"}</td>
      <td>
        <span class="status-pill status-${toStatusClass(order.status)}">
          ${order.status || "New"}
        </span>
      </td>
    `;

    tr.onclick = () => {
  STATE.selectedId = order.id;

  // ✅ mark as acknowledged
  acknowledge(order.id);

  [...tbody.children].forEach(r => r.classList.remove("active"));
  tr.classList.add("active");

  renderDetails(order);

  // 🔕 re-check sound state
  const pending = getUnacknowledgedNewOrders();
  if (pending.length === 0) {
    stopAlertSound();
  }
};

    tbody.appendChild(tr);

// 👇 FORCE VISIBILITY (matches your CSS)
requestAnimationFrame(() => {
  tr.classList.add("visible");
});
  });
}

/* ===============================
   DETAILS
================================ */
function renderDetails(order) {
  detailEmpty.style.display = "none";
  detailContent.hidden = false;

  detailContent.querySelector("[data-detail-id]").textContent = order.id;
  detailContent.querySelector("[data-detail-name]").textContent = order.customer?.name || "—";
  detailContent.querySelector("[data-detail-phone]").textContent = order.customer?.phone || "—";
  detailContent.querySelector("[data-detail-type]").textContent =
    order.fulfilment === "delivery" ? "Delivery" : "Pickup";
  detailContent.querySelector("[data-detail-address]").textContent =
    order.fulfilment === "delivery"
      ? order.customer?.address || "—"
      : "Pickup";
  detailContent.querySelector("[data-detail-total]").textContent =
    formatPrice(order.total);

  const itemsWrap = detailContent.querySelector("[data-detail-items]");
  itemsWrap.innerHTML = "";

  order.subOrders?.forEach((sub, i) => {
    const box = document.createElement("div");
    box.className = "admin-suborder";
    box.innerHTML = `
  <strong>Order ${i + 1}</strong>

  ${sub.notes ? `
    <div class="note">
      <strong>Note:</strong> <br>${sub.notes}
    </div>
  ` : ""}

  <ul class="suborder-items">
    ${sub.items.map(it => `
      <li>${it.qty} × ${it.name}</li>
    `).join("")}
  </ul>
`;
    itemsWrap.appendChild(box);
  });

  document.getElementById("current-status-text").textContent =
    order.status || "New";

  detailContent.querySelectorAll(".chip-status").forEach(btn =>
    btn.classList.toggle("is-current", btn.dataset.status === order.status)
  );
}

/* ===============================
   STATUS UPDATE
================================ */
detailPanel?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".chip-status");
  if (!btn || !STATE.selectedId) return;

  const order = STATE.orders.find(o => o.id === STATE.selectedId);
  if (!order || order.status === btn.dataset.status) return;



  await updateDoc(doc(db, "orders", order.id), {
    status: btn.dataset.status,
    lastStatusUpdateAt: serverTimestamp()
  });

    // ===============================
// EMAIL NOTIFICATION
// ===============================
if (order.customer?.email && window.emailjs) {
  emailjs.send(
    "service_m12snos",
    "template_7o73g4h",
    {
      customer_name: order.customer.name,
      order_id: order.id,
      status: btn.dataset.status,
      customer_email: order.customer.email,
    }
  ).catch(() => {});
}

  const phone = normalizePhone(order.customer.phone);

// Build order items summary
const itemsSummary = order.subOrders
  ?.map(sub =>
    sub.items
      .map(it => `• ${it.qty} x ${it.name}`)
      .join("\n")
  )
  .join("\n") || "• No items";

// 🔗 Track link (CHANGE domain/path if needed)
const trackLink = `https://kandystreats.com.ng/track.html?code=${order.id}`;
const msg = `Hello ${order.customer.name} 👋

*Order Update from Kandys Treats*

*Order ID:* ${order.id}
*Status:* *${btn.dataset.status}*

*Order Summary:*
${itemsSummary}

*Total Paid:* ${formatPrice(order.total)}

📍 *Track your order:*
${trackLink}

Reply here if you need help 💬

Thank you for choosing Kandys Treats ❤️`;

const cleanPhone = normalizePhone(order.customer.phone);

const webLink =
  `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

const isMobile =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

if (isMobile) {

  // Mobile devices
  window.location.href = webLink;

} else {

  // Desktop
  window.open(webLink, "_blank");

}

});



/* ===============================
   STATS
================================ */
function updateStats() {
  const o = STATE.orders;

  statTotal.textContent = o.length;
  statNew.textContent = o.filter(x => x.status === "New").length;
  statPreparing.textContent = o.filter(x => x.status === "Preparing").length;
  statCompleted.textContent = o.filter(x => x.status === "Completed").length;

  statRevenue.textContent = formatPrice(
    o.filter(x => isToday(x.createdAt))
     .reduce((s, x) => s + (x.netAmount || 0), 0)
  );
}

/* ===============================
   PRINT
================================ */
printBtn?.addEventListener("click", () => window.print());

/* ===============================
   SOUND TOGGLE (UI ONLY)
================================ */
soundBtn?.addEventListener("click", () => {
  STATE.soundOn = !STATE.soundOn;
  soundBtn.textContent = STATE.soundOn ? "Sound: On" : "Sound: Off";

  if (!STATE.soundOn) {
    stopAlertSound();
  } else {
    const pending = getUnacknowledgedNewOrders();
    if (pending.length > 0) {
      startAlertSound();
    }
  }
});

function inDateRange(order) {
  if (!order.createdAt) return false;

  const d = order.createdAt.toDate();
  const now = new Date();

  if (STATE.dateRange === "today") {
    return d.toDateString() === now.toDateString();
  }

  if (STATE.dateRange === "yesterday") {
    const y = new Date();
    y.setDate(now.getDate() - 1);
    return d.toDateString() === y.toDateString();
  }

  if (STATE.dateRange === "7days") {
    const past = new Date();
    past.setDate(now.getDate() - 7);
    return d >= past;
  }

  return true; // all
}

document.querySelector(".date-filters")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-range]");
  if (!btn) return;

  STATE.dateRange = btn.dataset.range;

  document
    .querySelectorAll(".date-filters .chip")
    .forEach(b => b.classList.toggle("is-active", b === btn));

  renderTable();
});


async function enableAdminNotifications() {

  if (!("Notification" in window)) {
    alert("Notifications not supported on this device");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    alert("Notification permission denied");
    return;
  }

  const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");

  const token = await getToken(messaging, {
    vapidKey: "BDOZiSxAx_7P0JoHWv_UQOW8xIdpez_4RTAwnYTE-QNJAPS6CRmM2XbbT3K409uwDoCu4ebxPjXFRqQoMyRcGwg",
    serviceWorkerRegistration: registration
  });

  await setDoc(doc(db, "adminTokens", token), {
    token: token,
    createdAt: serverTimestamp()
  });

  console.log("Admin push token:", token);

  enableNotifBtn.textContent = "Notifications Enabled ✅";

}



onMessage(messaging, (payload) => {

  console.log("Foreground message:", payload);

  if (Notification.permission === "granted") {

    new Notification(payload.notification.title, {
      body: payload.notification.body,
      icon: "/images/logo.png"
    });

  }

});

enableNotifBtn?.addEventListener("click", () => {
  enableAdminNotifications();
});
