import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import {
  hasPublicPaymentKey,
  startPublicGatewayPayment,
} from "./js/payment-public-client.js";
import {
  DRAFT_ORDERS_BASE_KEY,
  LAST_ORDER_BASE_KEY,
  clearLegacyCustomerStorage,
  removeScopedStorage,
  writeTextStorage,
} from "./js/customer-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWDTVJgW5dqcBbnZRb6m_Yz-fB7flO9nU",
  authDomain: "kandystreat-840b1.firebaseapp.com",
  projectId: "kandystreat-840b1",
  storageBucket: "kandystreat-840b1.firebasestorage.app",
  messagingSenderId: "394965571986",
  appId: "1:394965571986:web:ce79a02096c2eb2f2b094b",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");

const orderIdEl = document.getElementById("pay-order-id");
const amountEl = document.getElementById("pay-amount");
const paystackBtn = document.getElementById("pay-paystack");
const flutterwaveBtn = document.getElementById("pay-flutterwave");
const errorEl = document.getElementById("pay-error");
const statusEl = document.getElementById("pay-status");

const qs = new URLSearchParams(window.location.search);
const orderId = qs.get("order");

let orderData = null;
let currentUser = null;
let returnHandled = false;

function showError(message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = !message;
}

function showStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.hidden = !message;
}

function clearMessages() {
  showError("");
  showStatus("");
}

function backendPaymentUnavailable(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return code.includes("not-found")
    || code.includes("unimplemented")
    || code.includes("internal")
    || code.includes("unavailable")
    || code.includes("failed-precondition")
    || message.includes("secret key is not configured")
    || message.includes("not found")
    || message.includes("cors")
    || message.includes("failed to fetch");
}

function pendingVerificationMessage(provider, reference) {
  const label = provider === "paystack" ? "Paystack" : "Flutterwave";
  return `${label} checkout returned reference ${reference}. Secure server verification is still pending, so this order was not marked paid automatically.`;
}

function setButtonsDisabled(isDisabled) {
  if (paystackBtn) paystackBtn.disabled = isDisabled;
  if (flutterwaveBtn) flutterwaveBtn.disabled = isDisabled;
}

function redirectToAuth() {
  const next = `${location.pathname.split("/").pop() || "pay.html"}${location.search}`;
  window.location.href = `/auth.html?next=${encodeURIComponent(next)}`;
}

function callbackUrl(provider) {
  const url = new URL("/pay.html", window.location.origin);
  url.searchParams.set("order", orderId);
  url.searchParams.set("provider", provider);
  return url.href;
}

function cleanProvider(value) {
  const provider = String(value || "").toLowerCase();
  return ["paystack", "flutterwave"].includes(provider) ? provider : "";
}

function returnPayload() {
  const provider = cleanProvider(qs.get("provider"));
  if (!provider) return null;

  return {
    provider,
    status: String(qs.get("status") || "").toLowerCase(),
    reference: qs.get("reference") || qs.get("trxref") || qs.get("tx_ref") || "",
    gatewayTransactionId: qs.get("transaction_id") || qs.get("id") || "",
  };
}

function cleanupPaymentQuery() {
  const url = new URL(window.location.href);
  ["provider", "status", "reference", "trxref", "tx_ref", "transaction_id", "id"].forEach((key) => {
    url.searchParams.delete(key);
  });
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

async function handleGatewayReturn() {
  if (returnHandled || !orderData || !currentUser) return;
  const payload = returnPayload();
  if (!payload) return;

  returnHandled = true;
  setButtonsDisabled(true);
  clearMessages();

  try {
    if (["cancelled", "canceled"].includes(payload.status)) {
      const recordGatewayPaymentEvent = httpsCallable(functions, "recordGatewayPaymentEvent");
      await recordGatewayPaymentEvent({
        orderId,
        provider: payload.provider,
        reference: payload.reference,
        status: "cancelled",
        reason: "Customer cancelled checkout",
      });
      showError("Payment was cancelled. You can try again when ready.");
      cleanupPaymentQuery();
      setButtonsDisabled(false);
      return;
    }

    if (payload.status === "failed") {
      const recordGatewayPaymentEvent = httpsCallable(functions, "recordGatewayPaymentEvent");
      await recordGatewayPaymentEvent({
        orderId,
        provider: payload.provider,
        reference: payload.reference,
        status: "failed",
        reason: "Gateway returned a failed status",
      });
      showError("Payment failed. Please try again or use another payment option.");
      cleanupPaymentQuery();
      setButtonsDisabled(false);
      return;
    }

    await verifyGatewayPayload(payload);
  } catch (error) {
    console.error(error);
    if (backendPaymentUnavailable(error)) {
      showError(pendingVerificationMessage(payload.provider, payload.reference || "pending"));
    } else {
      showError(error.message || "Payment verification failed. Please contact support if money was deducted.");
    }
    cleanupPaymentQuery();
    setButtonsDisabled(false);
  } finally {
    showStatus("");
  }
}

async function verifyGatewayPayload(payload) {
  showStatus("Verifying your payment securely...");
  const verifyGatewayPayment = httpsCallable(functions, "verifyGatewayPayment");
  const result = await verifyGatewayPayment({
    orderId,
    provider: payload.provider,
    reference: payload.reference,
    gatewayTransactionId: payload.gatewayTransactionId,
  });

  const status = result.data?.status;
  if (status === "paid" || status === "already_paid") {
    removeScopedStorage(DRAFT_ORDERS_BASE_KEY, currentUser?.uid || null);
    writeTextStorage(LAST_ORDER_BASE_KEY, currentUser?.uid || null, orderId);
    window.location.href = `/track.html?code=${encodeURIComponent(orderId)}`;
    return true;
  }

  showError("Payment could not be confirmed. Please try again.");
  cleanupPaymentQuery();
  setButtonsDisabled(false);
  return false;
}

async function loadOrder() {
  if (!currentUser) {
    redirectToAuth();
    return;
  }

  if (!orderId) {
    showError("Invalid payment link.");
    setButtonsDisabled(true);
    return;
  }

  setButtonsDisabled(true);
  showStatus("Loading your order...");

  try {
    const snap = await getDoc(doc(db, "orders", orderId));

    if (!snap.exists()) {
      showError("Order not found.");
      return;
    }

    orderData = snap.data();

    if (orderData.userId && orderData.userId !== currentUser.uid) {
      showError("Login with the account that created this order.");
      return;
    }

    if (orderData.paid === true) {
      writeTextStorage(LAST_ORDER_BASE_KEY, currentUser.uid, orderId);
      window.location.href = `/track.html?code=${encodeURIComponent(orderId)}`;
      return;
    }

    orderIdEl.textContent = orderId;
    amountEl.textContent = Number(orderData.total || 0).toLocaleString("en-NG");
    setButtonsDisabled(false);
    await handleGatewayReturn();
  } catch (error) {
    console.error(error);
    showError("Could not load this order. Please try again.");
  } finally {
    showStatus("");
  }
}

async function startGatewayPayment(provider) {
  if (!orderData) {
    showError("Order not ready.");
    return;
  }

  setButtonsDisabled(true);
  clearMessages();
  showStatus(`Opening ${provider === "paystack" ? "Paystack" : "Flutterwave"} checkout...`);

  const startPublicFallback = async () => {
    if (!hasPublicPaymentKey(provider)) {
      throw Object.assign(new Error("Payment public key is not configured yet."), { code: "missing-public-key" });
    }

    const reference = `KT-${orderId}-${Date.now()}`;
    showStatus(`Opening ${provider === "paystack" ? "Paystack" : "Flutterwave"} public-key checkout...`);
    const gateway = await startPublicGatewayPayment({
      provider,
      orderId,
      amount: Number(orderData.total || 0),
      callbackUrl: callbackUrl(provider),
      customer: {
        name: orderData.customer?.name || currentUser.displayName || "Kandys Treats Customer",
        email: orderData.customer?.email || currentUser.email || "",
        phone: orderData.customer?.phone || "",
      },
      metadata: {
        orderId,
        userId: currentUser.uid,
        transactionId: reference,
        source: "public_key_checkout",
        reference,
      },
    });

    if (gateway.status !== "success") {
      showError("Payment was not completed. Please try again or choose another provider.");
      setButtonsDisabled(false);
      showStatus("");
      return;
    }

    try {
      await verifyGatewayPayload(gateway);
    } catch (verificationError) {
      console.error(verificationError);
      showError(pendingVerificationMessage(provider, gateway.reference));
      setButtonsDisabled(false);
      showStatus("");
    }
  };

  try {
    const createGatewayPayment = httpsCallable(functions, "createGatewayPayment");
    const result = await createGatewayPayment({
      orderId,
      provider,
      callbackUrl: callbackUrl(provider),
    });

    if (result.data?.status === "already_paid") {
      window.location.href = `/track.html?code=${encodeURIComponent(orderId)}`;
      return;
    }

    const authorizationUrl = result.data?.authorizationUrl;
    if (!authorizationUrl) {
      throw new Error("Gateway did not return a checkout link.");
    }

    window.location.href = authorizationUrl;
  } catch (error) {
    console.error(error);
    if (backendPaymentUnavailable(error)) {
      try {
        await startPublicFallback();
        return;
      } catch (fallbackError) {
        console.error(fallbackError);
        const message = fallbackError.code === "missing-public-key"
          ? "Payment public key is not configured yet. Add the provider public key to continue while secret-key verification is pending."
          : fallbackError.message || "Could not open payment checkout.";
        showError(message);
      }
    } else {
      showError(error.message || "Could not start payment. Please try again.");
    }
    setButtonsDisabled(false);
    showStatus("");
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    redirectToAuth();
    return;
  }

  currentUser = user;
  clearLegacyCustomerStorage();
  window.dispatchEvent(new CustomEvent("kandys:account-storage-change", {
    detail: { uid: user.uid },
  }));
  loadOrder();
});

paystackBtn?.addEventListener("click", () => startGatewayPayment("paystack"));
flutterwaveBtn?.addEventListener("click", () => startGatewayPayment("flutterwave"));

document.getElementById("back-to-cart")?.addEventListener("click", () => {
  window.location.href = "/orders-preview.html";
});
