import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

/* ================= ELEMENTS ================= */

const orderIdEl = document.getElementById("pay-order-id");
const amountEl = document.getElementById("pay-amount");
const paystackBtn = document.getElementById("pay-paystack");
const flutterwaveBtn = document.getElementById("pay-flutterwave");
const errorEl = document.getElementById("pay-error");

/* ================= HELPERS ================= */

const qs = new URLSearchParams(window.location.search);
const orderId = qs.get("order");

let orderData = null;
let flutterwaveCompleted = false;

const showError = (msg) => {
  errorEl.textContent = msg;
  errorEl.hidden = false;
};

const disableButtons = () => {
  paystackBtn.disabled = true;
  flutterwaveBtn.disabled = true;
};

const enableButtons = () => {
  paystackBtn.disabled = false;
  flutterwaveBtn.disabled = false;
};

/* ================= LOAD ORDER ================= */

async function loadOrder() {
  if (!orderId) {
    showError("Invalid payment link.");
    return;
  }

  const snap = await getDoc(doc(db, "orders", orderId));

  if (!snap.exists()) {
    showError("Order not found.");
    return;
  }

  orderData = snap.data();

  if (orderData.paid === true) {
    window.location.href = `/track.html?code=${orderId}`;
    return;
  }

  orderIdEl.textContent = orderId;
  amountEl.textContent = Number(orderData.total).toLocaleString("en-NG");

  enableButtons();
}

loadOrder();

/* ================= PAYSTACK ================= */

paystackBtn.addEventListener("click", () => {
  if (!orderData) return showError("Order not ready.");

  disableButtons();

  window.startPaystackPayment({
    key: "pk_live_bd05647da5ae5885013df5fdbc07c7545d7adf70",
    email: orderData.customer?.email || "ads.kandystreats@gmail.com",
    amount: Math.round(orderData.total * 100),
    reference: orderId,

    metadata: {
      orderId,
      customer: orderData.customer || {}
    },

    onSuccess: () => {
      window.location.href = `/track.html?code=${orderId}&verifying=1`;
    },

    onClose: () => {
      showError("Payment cancelled.");
      enableButtons();
    }
  });
});

/* ================= FLUTTERWAVE ================= */

flutterwaveBtn.addEventListener("click", () => {
  if (!window.FlutterwaveCheckout) {
    return showError("Flutterwave failed to load.");
  }

  if (!orderData) return showError("Order not ready.");

  disableButtons();
  flutterwaveCompleted = false;

  FlutterwaveCheckout({
    public_key: "FLWPUBK-3094f9362789db81b6b2afb5e7c1a080-X",
    tx_ref: orderId,
    amount: orderData.total,
    currency: "NGN",

    customer: {
      email: orderData.customer?.email || "ads.kandystreats@gmail.com",
      phone_number: orderData.customer?.phone,
      name: orderData.customer?.name,
    },

    callback: (res) => {
      console.log("FLW CALLBACK:", res);

      if (res.status === "successful") {
        flutterwaveCompleted = true;
        window.location.href = `/track.html?code=${orderId}&verifying=1`;
      }
    },

    onclose: () => {
  if (!flwPaymentCompleted) {
    showError("Payment window closed.");
    enableButtons();
  }
}
  });
});

/* ================= NAV ================= */

document.getElementById("back-to-cart")?.addEventListener("click", () => {
  window.location.href = "/orders-preview.html";
});