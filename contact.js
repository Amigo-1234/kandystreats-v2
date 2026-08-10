import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./js/firebase-core.js";

const showToast = (message) => {
  if (window.showToast) {
    window.showToast(message);
    return;
  }
  console.info(message);
};

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("contact-name").value.trim();
    const phone = document.getElementById("contact-phone").value.trim();
    const message = document.getElementById("contact-message").value.trim();

    if (!name || !phone || !message) {
      showToast("Please fill all fields");
      return;
    }

    try {
      await addDoc(collection(db, "contactMessages"), {
        name,
        phone,
        message,
        createdAt: serverTimestamp(),
        replied: false
      });

      form.reset();
      showToast("Message sent. We’ll get back to you shortly ❤️");

    } catch (err) {
      console.error(err);
      showToast("Failed to send message. Try again.");
    }
  });
});
