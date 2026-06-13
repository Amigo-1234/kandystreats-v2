import {
  collection,
  getDocs,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const IMAGE_BASE = "/images/menu";

const IMAGE_MAP = {
  "Amala": "amala.jpg",
  "Beans (per scoop)": "beans.jpg",
  "White Rice (per scoop)": "rice.jpg",
  "Rice and Beans": "riceandbeans.jpg",
  "Jollof Rice (per scoop)": "jollof-rice.jpg",
  "Fried Rice (per scoop)": "jollofrice.jpg",
  "Spaghetti (per scoop)": "spaghetti.jpg",
  "Ofada Rice (per scoop)": "ofada.jpg",
  "Pounded Yam": "poundedyam.jpg",

  // 🍲 Soups
  "Catfish Pepper Soup (Head)": "catfishsoup.jpg",
  "Catfish Pepper Soup (Middle/Tail)": "catfishsoup.jpg",

  // 🍗 Proteins
  "Big Chicken": "chickenandchips.jpg",
  "Small Chicken": "chickenandchips.jpg",
  "Beef": "Meat.jpg",
  "Small Beef": "Meat.jpg",
  "Big Fish": "catfishsoup.jpg",
  "Peppered Gizzard (stick)": "gizzard.jpg",
  "Small Turkey": "turkey.jpg",
  "Big Turkey": "bigturkey.jpg",

  // 🥗 Sides
  "Plantain": "plantain.jpg",
  "Salad (Single Cream)": "salad.jpeg",
  "Salad (Double Cream)": "salad.jpeg",

  // 🍔 Specials
  "Chicken & Chips": "chickenandchips.jpg",
  "Meat Pie": "meat-pie.jpg",
  "Kandy’s Parfait (Small)": "parfait.jpg",
  "Kandy’s Parfait (Big)": "parfait.jpg",

  // 🌯 Shawarma
  "Beef Shawarma (1 Sausage)": "Shawarma.jpg",
  "Beef Shawarma (2 Sausage)": "Shawarma.jpg",
  "Chicken Shawarma (1 Sausage)": "Shawarma.jpg",
  "Chicken Shawarma (2 Sausage)": "Shawarma.jpg",
  "Special Shawarma": "Shawarma.jpg",

  // 🥤 Drinks
  "Tiger Nut": "TigerNut.jpg",
  "Hollandia Yogurt": "Hollandia.jpg",
  "Chivita Active / Exotic": "Chivita.jpg",
  "Can Chivita": "Chivita.jpg",
  "Fanta / Coke / Pepsi / Soda / Teem": "drink.jpg",
  "Fearless / Predator": "drink.jpg",
  "Malt": "drink.jpg",
  "Nutri Milk": "drink.jpg",
  "Nutri Choco": "drink.jpg",
  "Pulpy": "drink.jpg",
  "Fayrouz": "drink.jpg",
  "Viju Milk": "drink.jpg",
  "Viju Choco": "drink.jpg",
  "Heineken": "drink.jpg",
  "Smirnoff": "drink.jpg",
  "Bullet": "drink.jpg",
};


async function seedMenuImages() {
  const menusRef = collection(window.db, "menus");
  const snap = await getDocs(menusRef);

  let updated = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const imgFile = IMAGE_MAP[data.name];

    if (!imgFile) continue;

    await updateDoc(doc(window.db, "menus", d.id), {
      image: `${IMAGE_BASE}/${imgFile}`
    });

    updated++;
  }

  alert(`✅ Updated images for ${updated} menu items`);
}

window.seedMenuImages = seedMenuImages;
