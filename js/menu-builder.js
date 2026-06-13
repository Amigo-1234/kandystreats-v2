import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const sectionsEl = document.getElementById("menu-sections");
  const itemsEl = document.getElementById("menu-item-list");
  const addSectionBtn = document.getElementById("add-menu-section");
  const addItemBtn = document.getElementById("add-menu-item");
  const titleEl = document.getElementById("active-menu-title");

  if (!sectionsEl || !itemsEl) return;

  const menusRef = collection(window.db, "menus");
  const menusQuery = query(menusRef, orderBy("createdAt", "asc"));

  let activeSection = null;
  let menuItems = [];

  onSnapshot(menusQuery, (snap) => {
    menuItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!activeSection && menuItems.length) {
      activeSection = menuItems[0].section;
      titleEl.textContent = activeSection;
    }

    renderSections();
    renderItems();
  });

  function renderSections() {
    sectionsEl.innerHTML = "";
    const sections = [...new Set(menuItems.map(i => i.section))];

    sections.forEach(section => {
      const btn = document.createElement("button");
      btn.className =
        "menu-section" + (section === activeSection ? " is-active" : "");
      btn.textContent = section;

      btn.onclick = () => {
        activeSection = section;
        titleEl.textContent = section;
        renderSections();
        renderItems();
      };

      sectionsEl.appendChild(btn);
    });
  }

function renderItems() {
  itemsEl.innerHTML = "";

  const items = menuItems.filter(i => i.section === activeSection);

  if (!items.length) {
    itemsEl.innerHTML = `<p style="opacity:.5">No items in this section</p>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "menu-item";

    card.innerHTML = `
      <img src="${item.image || 'https://via.placeholder.com/80'}" />

      <div class="item-info">
        <input class="name" value="${item.name}" />
        <input class="price" type="number" value="${item.price}" />
        <input class="image" placeholder="Image URL" value="${item.image || ""}" />
      </div>

      <div class="item-actions">
        <button class="status ${item.status}">
          ${item.status === "available" ? "Available" : "Sold out"}
        </button>
        <button class="outline-btn save">Save</button>
        <button class="outline-btn delete">Delete</button>
      </div>
    `;

    const nameInput = card.querySelector(".name");
    const priceInput = card.querySelector(".price");
    const imageInput = card.querySelector(".image");
    const statusBtn = card.querySelector(".status");
    const saveBtn = card.querySelector(".save");
    const deleteBtn = card.querySelector(".delete");
    const img = card.querySelector("img");

    let draft = { ...item };

    nameInput.oninput = () => draft.name = nameInput.value.trim();
    priceInput.oninput = () => draft.price = Number(priceInput.value);
    imageInput.oninput = () => {
      draft.image = imageInput.value.trim();
      img.src = draft.image || "https://via.placeholder.com/80";
    };

    statusBtn.onclick = () => {
      draft.status = draft.status === "available" ? "sold-out" : "available";
      statusBtn.textContent = draft.status === "available" ? "Available" : "Sold out";
      statusBtn.className = `status ${draft.status}`;
    };

    saveBtn.onclick = async () => {
      await updateDoc(doc(window.db, "menus", item.id), {
        name: draft.name,
        price: draft.price,
        image: draft.image || "",
        status: draft.status,
        updatedAt: serverTimestamp()
      });
    };

    deleteBtn.onclick = async () => {
      if (!confirm(`Delete ${item.name}?`)) return;
      await deleteDoc(doc(window.db, "menus", item.id));
    };

    itemsEl.appendChild(card);
  });
}
  addSectionBtn.onclick = async () => {
    const name = prompt("Menu section name?");
    if (!name) return;

    activeSection = name;
    titleEl.textContent = name;

    await addDoc(menusRef, {
      name: "New Dish",
      price: 0,
      status: "available",
      section: name,
      image: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };

  addItemBtn.onclick = async () => {
    if (!activeSection) return;

    await addDoc(menusRef, {
      name: "New Dish",
      price: 0,
      status: "available",
      section: activeSection,
      image: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };
});