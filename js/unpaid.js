import { auth, db } from "./firebase-core.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const wrap = document.getElementById("unpaid-orders");
const ADMIN_ROLES = new Set(["staff", "admin", "superAdmin", "super-admin", "owner"]);

function formatPrice(value) {
  return `\u20a6${Number(value || 0).toLocaleString("en-NG")}`;
}

function renderMessage(title, detail = "") {
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="card">
      <h3>${title}</h3>
      ${detail ? `<p class="muted">${detail}</p>` : ""}
    </div>
  `;
}

async function assertAdmin(user) {
  if (!user) return false;
  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() && ADMIN_ROLES.has(snap.data().role);
}

function startUnpaidListener() {
  const unpaidQuery = query(
    collection(db, "orders"),
    where("paid", "==", false),
    orderBy("createdAtMs", "desc"),
  );

  onSnapshot(unpaidQuery, (snap) => {
    if (!wrap) return;
    wrap.innerHTML = "";

    if (snap.empty) {
      renderMessage("No unpaid orders");
      return;
    }

    snap.forEach((docSnap) => {
      const order = { id: docSnap.id, ...docSnap.data() };
      const card = document.createElement("div");
      card.className = "card unpaid-card";
      card.innerHTML = `
        <div class="unpaid-top">
          <div>
            <h3>${order.id}</h3>
            <p>${order.customer?.name || "Unknown"}</p>
            <span>${order.customer?.phone || ""}</span>
          </div>
          <div class="amount">${formatPrice(order.total)}</div>
        </div>
        <div class="unpaid-actions">
          <button class="btn btn-primary mark-paid" type="button">Mark Paid</button>
        </div>
      `;

      card.querySelector(".mark-paid")?.addEventListener("click", async () => {
        await updateDoc(doc(db, "orders", order.id), {
          paid: true,
          paymentProvider: "manual",
          paymentRef: `manual-${Date.now()}`,
          paymentStatus: "confirmed",
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      wrap.appendChild(card);
    });
  }, (error) => {
    console.error(error);
    renderMessage("Could not load unpaid orders", "Check that this account has an admin role.");
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "super-admin-login.html";
    return;
  }

  if (!(await assertAdmin(user))) {
    await signOut(auth);
    window.location.href = "super-admin-login.html";
    return;
  }

  startUnpaidListener();
});
