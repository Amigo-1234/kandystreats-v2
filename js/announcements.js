import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
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

const input = document.getElementById("announcement-input");
const publishBtn = document.getElementById("publish-btn");
const list = document.getElementById("announcement-list");
const logoutBtn = document.getElementById("logout-btn");

/* ================= AUTH ================= */

onAuthStateChanged(auth, (user) => {
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

/* ================= CREATE ================= */

publishBtn.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;

  await addDoc(collection(db, "announcements"), {
    text,
    active: true,
    createdAt: serverTimestamp()
  });

  input.value = "";
};

/* ================= LISTENER ================= */

function startListener() {
  const q = query(
    collection(db, "announcements"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snap) => {
    list.innerHTML = "";

    if (snap.empty) {
      list.innerHTML = `<p class="muted">No announcements yet</p>`;
      return;
    }

    snap.forEach(docSnap => {
      const a = docSnap.data();

      const item = document.createElement("div");
      item.className = "announcement-item";

      item.innerHTML = `
        <div class="text">${a.text}</div>

        <div class="controls">
          <span class="status ${a.active ? "live" : "hidden"}">
            ${a.active ? "Live" : "Hidden"}
          </span>

          <button data-toggle>
            ${a.active ? "Hide" : "Show"}
          </button>

          <button data-edit>Edit</button>
          <button class="danger" data-delete>Delete</button>
        </div>
      `;

      // TOGGLE
      item.querySelector("[data-toggle]").onclick = () =>
        updateDoc(doc(db, "announcements", docSnap.id), {
          active: !a.active
        });

      // DELETE
      item.querySelector("[data-delete]").onclick = () => {
        if (confirm("Delete this announcement?")) {
          deleteDoc(doc(db, "announcements", docSnap.id));
        }
      };

      // EDIT
      item.querySelector("[data-edit]").onclick = () => {
        const updated = prompt("Edit announcement:", a.text);
        if (updated && updated.trim()) {
          updateDoc(doc(db, "announcements", docSnap.id), {
            text: updated.trim()
          });
        }
      };

      list.appendChild(item);
    });
  });
}