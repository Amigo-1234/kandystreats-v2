import { PAYMENT_PUBLIC_KEYS } from "./payment-public-config.js";

const SDK_URLS = {
  paystack: "https://js.paystack.co/v1/inline.js",
  flutterwave: "https://checkout.flutterwave.com/v3.js",
};

const SDK_GLOBALS = {
  paystack: "PaystackPop",
  flutterwave: "FlutterwaveCheckout",
};

function cleanProvider(provider) {
  const normalized = String(provider || "").toLowerCase();
  return normalized === "paystack" || normalized === "flutterwave" ? normalized : "";
}

export function getPublicPaymentKey(provider) {
  const normalized = cleanProvider(provider);
  return normalized ? String(PAYMENT_PUBLIC_KEYS[normalized] || "").trim() : "";
}

export function hasPublicPaymentKey(provider) {
  return Boolean(getPublicPaymentKey(provider));
}

function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve();

  const existing = document.querySelector(`script[data-payment-sdk="${globalName}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.paymentSdk = globalName;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Payment checkout could not load.")), { once: true });
    document.head.appendChild(script);
  });
}

function paymentCancelled(reference) {
  return Object.assign(new Error("Payment window was closed before confirmation."), {
    code: "payment-cancelled",
    reference,
  });
}

function normalizeAmount(amount) {
  const value = Math.round(Number(amount || 0));
  if (!Number.isFinite(value) || value < 100) {
    throw Object.assign(new Error("Enter a valid payment amount."), { code: "invalid-amount" });
  }
  return value;
}

export async function startPublicGatewayPayment({
  provider,
  orderId,
  amount,
  customer = {},
  callbackUrl = "",
  metadata = {},
}) {
  const normalized = cleanProvider(provider);
  const key = getPublicPaymentKey(normalized);
  const total = normalizeAmount(amount);
  const reference = String(metadata.reference || `KT-${orderId || "ORDER"}-${Date.now()}`).replace(/\s+/g, "-");

  if (!normalized || !key) {
    throw Object.assign(new Error("Payment public key is not configured."), { code: "missing-public-key" });
  }

  await loadScript(SDK_URLS[normalized], SDK_GLOBALS[normalized]);

  if (normalized === "paystack") {
    return new Promise((resolve, reject) => {
      const handler = window.PaystackPop.setup({
        key,
        email: customer.email || "",
        amount: total * 100,
        currency: "NGN",
        ref: reference,
        callback_url: callbackUrl,
        metadata,
        callback(response) {
          resolve({
            provider: normalized,
            reference: response?.reference || reference,
            gatewayTransactionId: "",
            status: "success",
            raw: response || {},
          });
        },
        onClose() {
          reject(paymentCancelled(reference));
        },
      });

      handler.openIframe();
    });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    window.FlutterwaveCheckout({
      public_key: key,
      tx_ref: reference,
      amount: total,
      currency: "NGN",
      payment_options: "card,banktransfer,ussd",
      redirect_url: callbackUrl,
      customer: {
        email: customer.email || "",
        phone_number: customer.phone || "",
        name: customer.name || "Kandys Treats Customer",
      },
      customizations: {
        title: "Kandy's Treats",
        description: "Food order payment",
      },
      meta: metadata,
      callback(response) {
        settled = true;
        if (typeof window.closePaymentModal === "function") window.closePaymentModal();
        resolve({
          provider: normalized,
          reference: response?.tx_ref || reference,
          gatewayTransactionId: String(response?.transaction_id || response?.id || ""),
          status: response?.status === "successful" ? "success" : String(response?.status || "pending"),
          raw: response || {},
        });
      },
      onclose() {
        if (!settled) reject(paymentCancelled(reference));
      },
    });
  });
}

