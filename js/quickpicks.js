import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ================= UTIL ================= */
const formatPrice = (v) =>
  `₦${Number(v || 0).toLocaleString("en-NG")}`;

document.addEventListener("DOMContentLoaded", () => {

  /* ================= ELEMENTS ================= */
  const grid = document.getElementById("qp-food-grid");
  const savedWrap = document.getElementById("qp-saved");
  const saveBtn = document.getElementById("save-quick-pick");

  const titleInput = document.getElementById("qp-title");
  const descInput = document.getElementById("qp-desc");
  const imageInput = document.getElementById("qp-image");
  const valentineInput = document.getElementById("qp-valentine");

  const previewWrap = document.getElementById("qp-preview-items");
  const previewTotal = document.getElementById("qp-preview-total");

  if (!grid || !saveBtn) return;

  /* ================= STATE ================= */
  const selected = {}; // { menuId: { name, price, qty } }

  /* ================= PREVIEW ================= */
  function updateQuickPickPreview(items) {
    if (!previewWrap || !previewTotal) return;

    if (!items.length) {
      previewWrap.innerHTML = `<p class="muted">No items selected yet</p>`;
      previewTotal.textContent = "₦0";
      return;
    }

    let total = 0;

    previewWrap.innerHTML = items.map(i => {
      const sum = i.price * i.qty;
      total += sum;

      return `
        <div class="qp-preview-item">
          <span>${i.name} × ${i.qty}</span>
          <strong>${formatPrice(sum)}</strong>
        </div>
      `;
    }).join("");

    previewTotal.textContent = formatPrice(total);
  }

  /* ================= LOAD MENU ================= */
  onSnapshot(collection(window.db, "menus"), snap => {
    grid.innerHTML = "";

    snap.forEach(docSnap => {
      const item = docSnap.data();
      let qty = 0;

      const card = document.createElement("div");
      card.className = "qp-food-card";

      card.innerHTML = `
        <h4>${item.name}</h4>
        <small>${formatPrice(item.price)}</small>

        <div class="qp-qty">
          <button class="minus">−</button>
          <span>0</span>
          <button class="plus">+</button>
        </div>
      `;

      const minus = card.querySelector(".minus");
      const plus = card.querySelector(".plus");
      const val = card.querySelector("span");

      function update() {
        val.textContent = qty;
        card.classList.toggle("active", qty > 0);

        if (qty > 0) {
          selected[docSnap.id] = {
            menuId: docSnap.id,
            name: item.name,
            price: item.price,
            qty
          };
        } else {
          delete selected[docSnap.id];
        }

        // 🔥 LIVE PREVIEW UPDATE
        updateQuickPickPreview(Object.values(selected));
      }

      plus.onclick = () => {
        qty++;
        update();
      };

      minus.onclick = () => {
        qty = Math.max(0, qty - 1);
        update();
      };

      grid.appendChild(card);
    });

    // reset preview on load
    updateQuickPickPreview([]);
  });

  /* ================= SAVE QUICK PICK ================= */
  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    const items = Object.values(selected);

    if (!title) {
      showToast("Combo name is required");
      return;
    }

    if (!items.length) {
      showToast("Pick at least one food");
      return;
    }

    try {
      await addDoc(collection(window.db, "quickPicks"), {
        title,
        description: descInput.value.trim(),
        image: imageInput.value.trim(),
        items,
        isValentine: valentineInput.checked,
        active: true,
        priority: Date.now(),
        createdAt: serverTimestamp()
      });

      showToast("Quick Pick saved ❤️");

      // RESET FORM
      titleInput.value = "";
      descInput.value = "";
      imageInput.value = "";
      valentineInput.checked = false;

      Object.keys(selected).forEach(k => delete selected[k]);

      document.querySelectorAll(".qp-food-card").forEach(card => {
        card.classList.remove("active");
        card.querySelector("span").textContent = "0";
      });

      updateQuickPickPreview([]);

    } catch (err) {
      console.error(err);
      showToast("Failed to save quick pick");
    }
  };

  /* ================= SAVED QUICK PICKS ================= */
  if (!savedWrap) return;

  onSnapshot(
    query(collection(window.db, "quickPicks"), orderBy("createdAt", "desc")),
    snap => {
      savedWrap.innerHTML = "";

      if (snap.empty) {
        savedWrap.innerHTML = `<p class="muted">No quick picks yet</p>`;
        return;
      }

      snap.forEach(docSnap => {
        const qp = docSnap.data();

        const card = document.createElement("div");
        card.className = "saved-card";

        card.innerHTML = `
          <div>
            <strong>${qp.title}</strong><br>
            <small>
              ${qp.items.length} items
              ${qp.isValentine ? " • ❤️ Valentine" : ""}
            </small>
          </div>

          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm ${qp.active ? "btn-primary" : "btn-outline"}">
              ${qp.active ? "Active" : "Hidden"}
            </button>
            <button class="btn btn-ghost btn-sm">🗑</button>
          </div>
        `;

        card.querySelector(".btn-sm").onclick = async () => {
          await updateDoc(doc(window.db, "quickPicks", docSnap.id), {
            active: !qp.active
          });
        };

        card.querySelector(".btn-ghost").onclick = async () => {
          if (!confirm("Delete this quick pick?")) return;
          await deleteDoc(doc(window.db, "quickPicks", docSnap.id));
          showToast("Quick Pick deleted");
        };

        savedWrap.appendChild(card);
      });
    }
  );
});