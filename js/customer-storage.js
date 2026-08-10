export const CART_BASE_KEY = "kandys_cart";
export const DRAFT_ORDERS_BASE_KEY = "kandys_draft_orders";
export const LAST_ORDER_BASE_KEY = "kandys_last_order_code";
export const GUEST_STORAGE_SCOPE = "guest";

const LEGACY_CUSTOMER_KEYS = [
  CART_BASE_KEY,
  DRAFT_ORDERS_BASE_KEY,
  LAST_ORDER_BASE_KEY,
];

export function storageScope(uid) {
  return uid || GUEST_STORAGE_SCOPE;
}

export function scopedStorageKey(baseKey, uid) {
  return `${baseKey}_${storageScope(uid)}`;
}

export function readJsonStorage(baseKey, uid, fallback) {
  try {
    const raw = localStorage.getItem(scopedStorageKey(baseKey, uid));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(baseKey, uid, value) {
  try {
    localStorage.setItem(scopedStorageKey(baseKey, uid), JSON.stringify(value));
  } catch (error) {
    console.warn("Could not save customer browser data.", error);
  }
}

export function readTextStorage(baseKey, uid) {
  try {
    return localStorage.getItem(scopedStorageKey(baseKey, uid)) || "";
  } catch {
    return "";
  }
}

export function writeTextStorage(baseKey, uid, value) {
  if (!value) {
    removeScopedStorage(baseKey, uid);
    return;
  }

  try {
    localStorage.setItem(scopedStorageKey(baseKey, uid), String(value));
  } catch (error) {
    console.warn("Could not save customer browser data.", error);
  }
}

export function removeScopedStorage(baseKey, uid) {
  try {
    localStorage.removeItem(scopedStorageKey(baseKey, uid));
  } catch (error) {
    console.warn("Could not clear customer browser data.", error);
  }
}

export function clearLegacyCustomerStorage() {
  LEGACY_CUSTOMER_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn("Could not clear legacy customer browser data.", error);
    }
  });
}

export function filterDraftsForUser(drafts, uid) {
  if (!Array.isArray(drafts)) return [];
  if (!uid) return drafts.filter((draft) => !draft?.userId);
  return drafts.filter((draft) => draft?.userId === uid);
}
