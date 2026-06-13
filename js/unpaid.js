import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "kandystreat-840b1",
  storageBucket: "kandystreat-840b1.firebasestorage.app",
  messagingSenderId: "394965571986",
  appId: "1:394965571986:web:ce79a02096c2eb2f2b094b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const wrap = document.getElementById("unpaid-orders");

function formatPrice(v) {
  return `₦${Number(v || 0).toLocaleString("en-NG")}`;
}

const q = query(
  collection(db, "orders"),
  where("paid", "==", false),
  orderBy("createdAtMs", "desc")
);

onSnapshot(q, (snap) => {

  wrap.innerHTML = "";

  if (snap.empty) {
    wrap.innerHTML = `
      <div class="card">
        <h3>No unpaid orders 🎉</h3>
      </div>
    `;
    return;
  }

  snap.forEach((docSnap) => {

    const order = docSnap.data();

    const card = document.createElement("div");
    card.className = "card unpaid-card";

    card.innerHTML = `
      <div class="unpaid-top">
        <div>
          <h3>${order.id}</h3>
          <p>${order.customer?.name || "Unknown"}</p>
          <span>${order.customer?.phone || ""}</span>
        </div>

        <div class="amount">
          ${formatPrice(order.total)}
        </div>
      </div>

      <div class="unpaid-actions">
        <button class="btn btn-primary mark-paid">
          Mark Paid
        </button>
      </div>
    `;

    card.querySelector(".mark-paid").onclick = async () => {

      await updateDoc(doc(db, "orders", order.id), {
        paid: true
      });

    };

    wrap.appendChild(card);

  });

});