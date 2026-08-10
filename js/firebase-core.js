import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCWDTVJgW5dqcBbnZRb6m_Yz-fB7flO9nU",
  authDomain: "kandystreat-840b1.firebaseapp.com",
  projectId: "kandystreat-840b1",
  storageBucket: "kandystreat-840b1.firebasestorage.app",
  messagingSenderId: "394965571986",
  appId: "1:394965571986:web:ce79a02096c2eb2f2b094b",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export const storage = getStorage(app);
export { serverTimestamp };

export const COLLECTIONS = {
  users: "users",
  wallets: "wallets",
  transactions: "transactions",
  orders: "orders",
  orderItems: "orderItems",
  addresses: "addresses",
  favourites: "favourites",
  notifications: "notifications",
  reviews: "reviews",
  supportTickets: "supportTickets",
};

export const ORDER_STATUSES = ["New", "Preparing", "Out", "Completed"];

export const COUPONS = {
  WELCOME5: {
    code: "WELCOME5",
    label: "Welcome discount",
    type: "percent",
    value: 5,
    minSubtotal: 1000,
  },
  KANDY10: {
    code: "KANDY10",
    label: "Kandys customer reward",
    type: "percent",
    value: 10,
    minSubtotal: 5000,
  },
};

export function formatPrice(value) {
  return `\u20a6${Number(value || 0).toLocaleString("en-NG")}`;
}

export function formatDateTime(value) {
  if (!value) return "-";
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function normalizePhone(phone) {
  if (!phone) return "";

  const digits = String(phone).replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("0")) return `234${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("7")) return `234${digits}`;
  return digits;
}

export function calculateCouponDiscount(coupon, subtotal) {
  if (!coupon || subtotal < (coupon.minSubtotal || 0)) return 0;
  if (coupon.type === "percent") return Math.round((subtotal * coupon.value) / 100);
  if (coupon.type === "fixed") return Math.min(subtotal, Number(coupon.value || 0));
  return 0;
}

export function getOrderItems(order) {
  if (!order) return [];
  if (Array.isArray(order.items)) return order.items;
  if (!Array.isArray(order.subOrders)) return [];
  return order.subOrders.flatMap((sub) => sub.items || []);
}

export function buildAuthRedirect(target = window.location.href) {
  const next = new URL(target, window.location.origin);
  return `auth.html?next=${encodeURIComponent(next.pathname + next.search + next.hash)}`;
}
