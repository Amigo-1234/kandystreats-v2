import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}


const menusRef = collection(window.db, "menus");

const MENU_DATA = [
  // 🍽️ Foods
  { section: "Foods", name: "Jollof Rice (per scoop)", price: 500 },
  { section: "Foods", name: "Fried Rice (per scoop)", price: 500 },
  { section: "Foods", name: "Spaghetti (per scoop)", price: 500 },
  { section: "Foods", name: "White Rice (per scoop)", price: 700 },
  { section: "Foods", name: "Ofada Rice (per scoop)", price: 700 },
  { section: "Foods", name: "Beans (per scoop)", price: 600 },

  // 🍗 Proteins
  { section: "Proteins", name: "Big Chicken", price: 2500 },
  { section: "Proteins", name: "Small Chicken", price: 1200 },
  { section: "Proteins", name: "Beef", price: 800 },
  { section: "Proteins", name: "Small Beef", price: 700 },
  { section: "Proteins", name: "Big Fish", price: 1000 },
  { section: "Proteins", name: "Peppered Gizzard (stick)", price: 1500 },
  { section: "Proteins", name: "Small Turkey", price: 3000 },
  { section: "Proteins", name: "Big Turkey", price: 3500 },

  // 🥗 Sides
  { section: "Sides", name: "Plantain", price: 350 },
  { section: "Sides", name: "Takeaway Pack", price: 200 },
  { section: "Sides", name: "Salad (Single Cream)", price: 700 },
  { section: "Sides", name: "Salad (Double Cream)", price: 800 },

  // 🍔 Specials
  { section: "Specials", name: "Chicken & Chips", price: 4800 },
  { section: "Specials", name: "Meat Pie", price: 1000 },
  { section: "Specials", name: "Kandy’s Parfait (Small)", price: 3500 },
  { section: "Specials", name: "Kandy’s Parfait (Big)", price: 5000 },

  // 🍲 Soups
  { section: "Soups", name: "Catfish Pepper Soup (Head)", price: 3500 },
  { section: "Soups", name: "Catfish Pepper Soup (Middle/Tail)", price: 3000 },

  // 🌯 Shawarma
  { section: "Shawarma", name: "Beef Shawarma (1 Sausage)", price: 2800 },
  { section: "Shawarma", name: "Beef Shawarma (2 Sausage)", price: 3100 },
  { section: "Shawarma", name: "Chicken Shawarma (1 Sausage)", price: 3000 },
  { section: "Shawarma", name: "Chicken Shawarma (2 Sausage)", price: 3300 },
  { section: "Shawarma", name: "Special Shawarma", price: 3600 },

  // 🥤 Drinks
  { section: "Drinks", name: "Tiger Nut", price: 1500 },
  { section: "Drinks", name: "Hollandia Yogurt", price: 2200 },
  { section: "Drinks", name: "Chivita Active / Exotic", price: 1900 },
  { section: "Drinks", name: "Can Chivita", price: 900 },
  { section: "Drinks", name: "Fanta / Coke / Pepsi / Soda / Teem", price: 500 },
  { section: "Drinks", name: "Fearless / Predator", price: 800 },
  { section: "Drinks", name: "Malt", price: 750 },
  { section: "Drinks", name: "Nutri Milk", price: 700 },
  { section: "Drinks", name: "Nutri Choco", price: 850 },
  { section: "Drinks", name: "Pulpy", price: 1500 },
  { section: "Drinks", name: "Fayrouz", price: 750 },
  { section: "Drinks", name: "Viju Milk", price: 750 },
  { section: "Drinks", name: "Viju Choco", price: 1200 },
  { section: "Drinks", name: "Heineken", price: 1500 },
  { section: "Drinks", name: "Smirnoff", price: 1800 },
  { section: "Drinks", name: "Bullet", price: 2500 },
];

async function seedMenu() {
  // 🔥 Clear existing menu
  const snap = await getDocs(menusRef);
  for (const doc of snap.docs) {
    await deleteDoc(doc.ref);
  }

  // 🌱 Seed new menu
  for (const item of MENU_DATA) {
    await addDoc(menusRef, {
      ...item,
      status: "available",
      image: `/images/menu/${slugify(item.name)}.jpg`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  alert("Foods section updated & menu reseeded ✅");
}

window.seedMenu = seedMenu;
