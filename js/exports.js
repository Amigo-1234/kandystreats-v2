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

const exportOrdersBtn = document.getElementById("export-orders");
const exportTransactionsBtn = document.getElementById("export-transactions");
const exportCustomersBtn = document.getElementById("export-customers");
const exportCustomBtn = document.getElementById("export-custom");

const rangeSelect = document.getElementById("range-select");
const typeSelect = document.getElementById("type-select");
const logoutBtn = document.getElementById("logout-btn");

/* ================= STATE ================= */

let allOrders = [];

/* ================= HELPERS ================= */

const formatDate = (ts) =>
  ts?.toDate().toLocaleDateString("en-GB") || "";

const withinRange = (ts, range) => {
  if (range === "all") return true;

  const now = new Date();
  const date = ts.toDate();

  if (range === "month") {
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }

  return (now - date) <= Number(range) * 86400000;
};

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

/* ================= AUTH ================= */

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "super-admin-login.html";
    return;
  }

  listenOrders();
});

logoutBtn.onclick = async () => {
  await signOut(auth);
  window.location.href = "super-admin-login.html";
};

/* ================= FIRESTORE ================= */

function listenOrders() {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));

  onSnapshot(q, snap => {
    allOrders = [];
    snap.forEach(d => allOrders.push(d.data()));
  });
}

/* ================= EXPORTS ================= */

exportOrdersBtn.onclick = () => {
  const rows = [
    ["Order ID", "Date", "Customer", "Phone", "Total", "Status", "Paid"]
  ];

  allOrders.forEach(o => {
    rows.push([
      o.id,
      formatDate(o.createdAt),
      o.customer?.name || "",
      o.customer?.phone || "",
      o.total || 0,
      o.status || "",
      o.paid ? "Yes" : "No"
    ]);
  });

  downloadCSV("orders.csv", rows);
};

exportTransactionsBtn.onclick = () => {
  const rows = [
    ["Order ID", "Date", "Customer", "Amount", "Status"]
  ];

  allOrders
    .filter(o => o.paid)
    .forEach(o => {
      rows.push([
        o.id,
        formatDate(o.createdAt),
        o.customer?.name || "",
        o.total || 0,
        o.status
      ]);
    });

  downloadCSV("transactions.csv", rows);
};

exportCustomersBtn.onclick = () => {
  const rows = [["Customer Name", "Phone"]];

  const seen = new Set();

  allOrders.forEach(o => {
    const key = o.customer?.phone;
    if (!key || seen.has(key)) return;
    seen.add(key);

    rows.push([
      o.customer?.name || "",
      o.customer?.phone || ""
    ]);
  });

  downloadCSV("customers.csv", rows);
};

exportCustomBtn.onclick = () => {
  const range = rangeSelect.value;
  const type = typeSelect.value;

  const filtered = allOrders.filter(o =>
    o.createdAt && withinRange(o.createdAt, range)
  );

  if (type === "orders") {
    exportOrdersBtn.onclick(filtered);
    return;
  }

  if (type === "transactions") {
    const rows = [
      ["Order ID", "Date", "Customer", "Amount"]
    ];

    filtered
      .filter(o => o.paid)
      .forEach(o => {
        rows.push([
          o.id,
          formatDate(o.createdAt),
          o.customer?.name || "",
          o.total || 0
        ]);
      });

    downloadCSV("custom-transactions.csv", rows);
  }

  if (type === "customers") {
    const rows = [["Customer Name", "Phone"]];
    const seen = new Set();

    filtered.forEach(o => {
      const phone = o.customer?.phone;
      if (!phone || seen.has(phone)) return;
      seen.add(phone);
      rows.push([o.customer?.name || "", phone]);
    });

    downloadCSV("custom-customers.csv", rows);
  }
};