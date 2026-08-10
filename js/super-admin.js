// super-admin.js

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


/* ================= FIREBASE INIT ================= */

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

const loginForm = document.getElementById("owner-login-form");
const loginSection = document.getElementById("owner-login");
const panel = document.getElementById("super-admin-panel");
const logoutBtn = document.getElementById("owner-logout");

const totalRevenueEl = document.getElementById("stat-total-revenue");
const todayRevenueEl = document.getElementById("stat-today-revenue");
const ordersCountEl = document.getElementById("stat-total-orders");

const tableBody = document.getElementById("transactions-body");

/* ================= HELPERS ================= */

const formatPrice = n =>
  `₦${Number(n || 0).toLocaleString("en-NG")}`;

const isToday = ts => {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

/* ================= LOGIN ================= */

loginForm?.addEventListener("submit", async e => {
  e.preventDefault();

  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert(err.message);
  }
});

/* ================= AUTH GATE ================= */

onAuthStateChanged(auth, async user => {
  if (!user) {
    panel.hidden = true;
    loginSection.hidden = false;
    return;
  }

  // 🔒 SUPER ADMIN CHECK
  let snap;

try {
   snap = await getDoc(doc(db, "users", user.uid));

if (!snap.exists() || !["superAdmin", "super-admin", "owner"].includes(snap.data().role)) {
  alert("Not authorized");
  await signOut(auth);
  return;
};
} catch (err) {
  alert("Permission error. Check Firestore rules.");
  await signOut(auth);
  return;
}

if (!snap.exists()) {
  alert("Not authorized as owner");
  await signOut(auth);
  return;
}

  loginSection.hidden = true;
  panel.hidden = false;

  startFinanceListener();
});

/* ================= LOGOUT ================= */

document.querySelectorAll("#super-logout, #owner-logout")
  .forEach(btn => {
    btn?.addEventListener("click", async () => {
      await signOut(auth);
    });
  });
// ================= GLOBAL STATE =================
let allTransactions = [];

// ================= HELPERS =================
const formatDate = ts => {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB");
};

const isWithinDays = (ts, days) => {
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  return (now - date) <= days * 24 * 60 * 60 * 1000;
};


const list = document.getElementById("announcement-list");
const input = document.getElementById("new-announcement");
const addBtn = document.getElementById("add-announcement");

const ref = collection(db, "announcements");
const q = query(ref, orderBy("createdAt", "desc"));

addBtn.addEventListener("click", async () => {
  if (!input.value.trim()) return;

  await addDoc(ref, {
    text: input.value.trim(),
    active: true,
    createdAt: serverTimestamp()
  });

  input.value = "";
});

onSnapshot(q, snap => {
  list.innerHTML = "";

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const li = document.createElement("li");
    li.className = `announcement-item ${data.active ? "is-active" : "is-hidden"}`;

    li.innerHTML = `
      <span>${data.text}</span>
      <div class="announcement-actions">
        <button data-edit>✏️</button>
        <button data-toggle>${data.active ? "Hide" : "Show"}</button>
        <button data-delete>🗑️</button>
      </div>
    `;

    if (snap.empty) {
      list.innerHTML = "<li class='muted'>No announcements yet</li>";
      return;
    }

    // Toggle
    li.querySelector("[data-toggle]").onclick = () =>
      updateDoc(doc(db, "announcements", docSnap.id), {
        active: !data.active
      });

    // Delete
    li.querySelector("[data-delete]").onclick = () =>
      deleteDoc(doc(db, "announcements", docSnap.id));

    // Edit
    li.querySelector("[data-edit]").onclick = () => {
      const updated = prompt("Edit announcement:", data.text);
      if (updated)
        updateDoc(doc(db, "announcements", docSnap.id), {
          text: updated
        });
    };

    list.appendChild(li);
  });
});



// ================= RENDER =================
function renderTransactions(transactions) {
  tableBody.innerHTML = "";

  transactions.forEach(o => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${o.id}</td>
      <td>${formatDate(o.createdAt)}</td>
      <td>${o.customer?.name || "-"}</td>
      <td>${formatPrice(o.total)}</td>
      <td>${o.status || "—"}</td>
      <td>
        <span class="badge ${o.paid ? "paid" : "unpaid"}">
          ${o.paid ? "Paid" : "Unpaid"}
        </span>
      </td>
    `;

    tr.addEventListener("click", () => {
      openOrderModal(o);
    });

    tableBody.appendChild(tr);
  });
}

// ================= FIRESTORE LISTENER =================
function startFinanceListener() {
  const q = query(
    collection(db, "orders"),
    orderBy("createdAt", "desc")
  );

  let unpaidCount = 0;

  onSnapshot(q, snap => {
    let totalRevenue = 0;
    let todayRevenue = 0;

    allTransactions = [];

    snap.forEach(docSnap => {
      const o = docSnap.data();
      if (!o.paid) {
        unpaidCount++;
        return;
      } 

      totalRevenue += o.total || 0;
      if (isToday(o.createdAt)) {
  todayRevenue += o.total || 0;
}



      allTransactions.push({
  id: o.id,
  createdAt: o.createdAt,
  customer: o.customer,
  total: o.total,
  status: o.status,
  paid: o.paid,
  items: o.items || [],
  subOrders: o.subOrders || []
});
    });


    totalRevenueEl.textContent = formatPrice(totalRevenue);
    todayRevenueEl.textContent = formatPrice(todayRevenue);
    ordersCountEl.textContent = allTransactions.length;

    renderTransactions(allTransactions);
  });
}

// ================= DATE FILTERS =================
document.querySelectorAll(".date-filters button").forEach(btn => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".date-filters button")
      .forEach(b => b.classList.remove("is-active"));

    btn.classList.add("is-active");

    const range = btn.dataset.range;
    let filtered = allTransactions;

    if (range === "today") {
      filtered = allTransactions.filter(t => isWithinDays(t.createdAt, 1));
    }

    if (range === "7") {
      filtered = allTransactions.filter(t => isWithinDays(t.createdAt, 7));
    }

    if (range === "30") {
      filtered = allTransactions.filter(t => isWithinDays(t.createdAt, 30));
    }

    renderTransactions(filtered);
  });
});

// ================= CSV EXPORT =================
document.getElementById("export-csv").onclick = () => {
  const headers = [
    "Order ID",
    "Date",
    "Customer",
    "Amount (NGN)",
    "Status",
    "Paid"
  ];

  const rows = allTransactions.map(t => [
    t.id,
    formatDate(t.createdAt),
    t.customer?.name || "",
    t.total,
    t.status || "",
    t.paid ? "Yes" : "No"
  ]);

  const csv = [headers, ...rows]
    .map(r => r.join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `kandys-transactions-${Date.now()}.csv`;
  a.click();

  URL.revokeObjectURL(url);
};



const modal = document.getElementById("order-modal");
const modalContent = document.getElementById("modal-content");
const modalOrderId = document.getElementById("modal-order-id");

function openOrderModal(order) {
  modalOrderId.textContent = order.id;

  const items =
    order.subOrders?.length
      ? order.subOrders.flatMap(s => s.items)
      : order.items || [];

  modalContent.innerHTML = `
    <p><strong>Status:</strong> ${order.status}</p>
    <p><strong>Customer:</strong> ${order.customer?.name}</p>
    <p><strong>Phone:</strong> ${order.customer?.phone}</p>

    <h4>Items</h4>
    <ul>
      ${
        items.length
          ? items.map(i => `<li>${i.qty} × ${i.name}</li>`).join("")
          : "<li>No items</li>"
      }
    </ul>

    <p><strong>Total:</strong> ${formatPrice(order.total)}</p>
  `;

  modal.classList.remove("hidden");
}
document.getElementById("close-modal").onclick = () =>
  modal.classList.add("hidden");

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.add("hidden");
  }
});

// ===============================
// DASHBOARD NAVIGATION
// ===============================
const navButtons = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".dashboard-view");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.view;

    // Sidebar active state
    navButtons.forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    // Switch views
    views.forEach(view => {
      view.classList.toggle(
        "hidden",
        view.dataset.view !== target
      );
    });
  });
});


/* ================= SEARCH ================= */

const searchInput = document.getElementById("transaction-search");

searchInput?.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();

  const filtered = allTransactions.filter(t =>
    String(t.id || "").toLowerCase().includes(q)
  );

  renderTransactions(filtered);
});

// ================= PRINT =================
document.getElementById("print-transactions").onclick = () => {
  window.print();
};
