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
const db = getFirestore(app);
const auth = getAuth(app);

/* ================= ELEMENTS ================= */

const bodyEl = document.getElementById("transactions-body");
const statTotal = document.getElementById("stat-total");
const statRevenue = document.getElementById("stat-revenue");
const statAverage = document.getElementById("stat-average");
const barsEl = document.getElementById("revenue-bars");
const searchInput = document.getElementById("search-input");
const logoutBtn = document.getElementById("logout-btn");

/* MODAL */
const modal = document.getElementById("order-modal");
const modalId = document.getElementById("modal-order-id");
const modalContent = document.getElementById("modal-content");
const closeModal = document.getElementById("close-modal");

/* ================= STATE ================= */

let allOrders = [];
let activeRange = 7;
let chartInstance = null;
/* ================= HELPERS ================= */

const formatPrice = n => `₦${Number(n || 0).toLocaleString("en-NG")}`;
const formatDate = ts =>
  ts?.toDate().toLocaleDateString("en-GB") || "—";

const withinDays = (ts, days) =>
  (Date.now() - ts.toDate().getTime()) <= days * 86400000;

/* ================= AUTH ================= */

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "super-admin-login.html";
    return;
  }
  startListener();
});

logoutBtn.onclick = async () => {
  await signOut(auth);
  window.location.href = "super-admin-login.html";
};

/* ================= FIRESTORE ================= */

function startListener() {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));

  onSnapshot(q, snap => {
    allOrders = [];

    snap.forEach(d => {
      const o = d.data();
      if (!o?.paid) return;
      allOrders.push(o);
    });

    applyFilters();
  });
}

/* ================= RENDER ================= */

function render(list) {
  bodyEl.innerHTML = "";

  list.forEach(o => {
    const row = document.createElement("div");
    row.className = "transaction-row";

    row.innerHTML = `
      <span class="order-id">${o.id}</span>
      <span>${formatDate(o.createdAt)}</span>
      <span>${o.customer?.name || "-"}</span>
      <span>${formatPrice(o.total)}</span>
      <span><span class="badge success">${o.status}</span></span>
      <span><span class="badge paid">Paid</span></span>
    `;

    row.onclick = () => openModal(o);
    bodyEl.appendChild(row);
  });

  updateStats(list);
}

/* ================= STATS ================= */

function updateStats(list) {
  const revenue = list.reduce((s, o) => s + o.total, 0);

  statTotal.textContent = list.length;
  statRevenue.textContent = formatPrice(revenue);
  statAverage.textContent =
    list.length ? formatPrice(revenue / list.length) : "₦0";

  renderChart(list);
}

/* ================= CHART ================= */

function renderChart(orders) {
  const ctx = document.getElementById("revenueChart");
  if (!ctx) return;

  // Group revenue by date
  const map = {};

  orders.forEach(o => {
    const date = o.createdAt.toDate().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short"
    });

    map[date] = (map[date] || 0) + o.total;
  });

  const labels = Object.keys(map);
  const values = Object.values(map);

  // Destroy previous chart (VERY IMPORTANT)
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Revenue",
        data: values,
        backgroundColor: "rgba(232,76,136,0.6)",
        borderRadius: 8,
        hoverBackgroundColor: "rgba(232,76,136,0.9)"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#aaa" }
        },
        y: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: {
            color: "#aaa",
            callback: v => `₦${v.toLocaleString()}`
          }
        }
      }
    }
  });
}

/* ================= FILTERS ================= */

document.querySelectorAll(".chart-filters button").forEach(btn => {
  btn.onclick = () => {
    document
      .querySelectorAll(".chart-filters button")
      .forEach(b => b.classList.remove("is-active"));

    btn.classList.add("is-active");
    activeRange = Number(btn.dataset.range);
    applyFilters();
  };
});

function applyFilters() {
  const filtered = allOrders.filter(o =>
    withinDays(o.createdAt, activeRange)
  );
  render(filtered);
}

/* ================= SEARCH ================= */

searchInput.oninput = () => {
  const q = searchInput.value.toLowerCase();
  render(allOrders.filter(o => o.id.toLowerCase().includes(q)));
};

/* ================= MODAL ================= */

function openModal(o) {
  modalId.textContent = `Order ${o.id}`;

  let itemsHtml = "";
let subtotal = 0;

// 🔥 Collect items from BOTH sources
const collectedItems = [];

if (Array.isArray(o.items)) {
  collectedItems.push(...o.items);
}

if (Array.isArray(o.subOrders)) {
  o.subOrders.forEach(s => {
    if (Array.isArray(s.items)) {
      collectedItems.push(...s.items);
    }
  });
}

// Render items
collectedItems.forEach(i => {
  const price = Number(i.price || 0);
  const qty = Number(i.qty || 1);
  const line = qty * price;

  subtotal += line;

  itemsHtml += `
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <span>${qty} × ${i.name}</span>
      <strong>${formatPrice(line)}</strong>
    </div>
  `;
});

  const fees = Math.max((o.total || 0) - subtotal, 0);

  modalContent.innerHTML = `
    <p><strong>Date:</strong> ${formatDate(o.createdAt)}</p>

    <hr>

    <p><strong>Customer</strong></p>
    <p>Name: ${o.customer?.name || "—"}</p>
    <p>Phone: ${o.customer?.phone || "—"}</p>

    <hr>

    <p><strong>Items</strong></p>
    ${itemsHtml || "<em>No items</em>"}

    <hr>

    <p><strong>Summary</strong></p>
    <p>Subtotal: ${formatPrice(subtotal)}</p>
    <p>Fees: ${formatPrice(fees)}</p>
    <p><strong>Total: ${formatPrice(o.total)}</strong></p>

    <hr>

    <p>
      <strong>Status:</strong>
      <span class="badge success">${o.status}</span>
    </p>

    <p>
      <strong>Payment:</strong>
      <span class="badge paid">Paid</span>
    </p>
  `;

  modal.classList.remove("hidden");
}

closeModal.onclick = () => modal.classList.add("hidden");
modal.onclick = e => e.target === modal && modal.classList.add("hidden");