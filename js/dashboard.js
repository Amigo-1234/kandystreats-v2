// ===============================
// FIREBASE IMPORTS
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// ===============================
// FIREBASE CONFIG
// ===============================
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

// ===============================
// ELEMENTS
// ===============================
const statTotalRevenue = document.getElementById("stat-total-revenue");
const statTodayRevenue = document.getElementById("stat-today-revenue");
const statTotalOrders = document.getElementById("stat-total-orders");
const statUnpaid = document.getElementById("stat-unpaid");

const snapshotOrdersToday = document.getElementById("snapshot-orders-today");
const snapshotRevenueToday = document.getElementById("snapshot-revenue-today");
const snapshotLastOrder = document.getElementById("snapshot-last-order");

const logoutBtn = document.querySelector(".sidebar-footer button");

// ===============================
// HELPERS
// ===============================
const formatPrice = n =>
  `₦${Number(n || 0).toLocaleString("en-NG")}`;

const isToday = ts => {
  if (!ts?.toDate) return false;
  const d = ts.toDate();
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

// ===============================
// AUTH GUARD
// ===============================
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "super-admin-login.html";
    return;
  }

  startDashboardListener();
});

// ===============================
// LOGOUT
// ===============================
logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "super-admin-login.html";
});

// ===============================
// REAL-TIME DASHBOARD DATA
// ===============================
function startDashboardListener() {
  const q = query(
    collection(db, "orders"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, snap => {
    let totalRevenue = 0;
    let todayRevenue = 0;
    let totalOrders = 0;
    let unpaidCount = 0;

    let ordersToday = 0;
    let lastOrderDate = "—";

    snap.forEach(docSnap => {
      const o = docSnap.data();
      if (!o) return;

      // Track unpaid
      if (!o.paid) {
        unpaidCount++;
        return;
      }

      totalOrders++;
      totalRevenue += o.total || 0;

      if (isToday(o.createdAt)) {
        todayRevenue += o.total || 0;
        ordersToday++;
      }

      if (lastOrderDate === "—" && o.createdAt?.toDate) {
        lastOrderDate = o.createdAt
          .toDate()
          .toLocaleString("en-NG", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
          });
      }
    });

    // ===============================
    // UPDATE UI (SAFE)
    // ===============================
    statTotalRevenue.textContent = formatPrice(totalRevenue);
    statTodayRevenue.textContent = formatPrice(todayRevenue);
    statTotalOrders.textContent = totalOrders;
    statUnpaid.textContent = unpaidCount;

    snapshotOrdersToday.textContent = ordersToday;
    snapshotRevenueToday.textContent = formatPrice(todayRevenue);
    snapshotLastOrder.textContent = lastOrderDate;
  });
}