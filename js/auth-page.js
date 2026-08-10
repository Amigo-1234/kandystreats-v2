import { auth, db, functions, COLLECTIONS, serverTimestamp, buildAuthRedirect } from "./firebase-core.js";
import {
  createUserWithEmailAndPassword,
  browserLocalPersistence,
  browserSessionPersistence,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

const params = new URLSearchParams(window.location.search);
const nextUrl = params.get("next") || "account.html";

const tabs = document.querySelectorAll("[data-auth-tab]");
const panels = document.querySelectorAll("[data-auth-panel]");
const message = document.getElementById("auth-message");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const forgotForm = document.getElementById("forgot-form");
const googleButton = document.getElementById("google-signin");
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
let redirectResultChecked = false;
let currentAuthUser = null;
let authRedirectStarted = false;
let explicitAuthFlow = false;

function showPanel(name) {
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.authTab === name));
  panels.forEach((panel) => {
    panel.hidden = panel.dataset.authPanel !== name;
  });
  showMessage("");
}

function showMessage(text, type = "info") {
  if (!message) return;
  message.textContent = text;
  message.dataset.type = type;
  message.hidden = !text;
}

function setFormBusy(form, isBusy) {
  form?.querySelectorAll("button, input").forEach((el) => {
    el.disabled = isBusy;
  });
}

function setAuthBusy(isBusy) {
  setFormBusy(loginForm, isBusy);
  setFormBusy(signupForm, isBusy);
  setFormBusy(forgotForm, isBusy);
  if (googleButton) googleButton.disabled = isBusy;
}

function friendlyError(error) {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) return "That email already has an account.";
  if (code.includes("invalid-email")) return "Please enter a valid email address.";
  if (code.includes("weak-password")) return "Use at least 6 characters for your password.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was closed before it finished.";
  if (code.includes("popup-blocked")) return "Your browser blocked the Google sign-in popup. Redirecting instead...";
  if (code.includes("account-exists-with-different-credential")) {
    return "This email already exists with another sign-in method. Login with that method first.";
  }
  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Email or password is incorrect.";
  }
  if (code.includes("permission-denied") || /insufficient permissions/i.test(error?.message || "")) {
    return "Your sign-in worked, but your account setup needs a quick refresh. Please try again.";
  }
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait and try again.";
  return error?.message || "Something went wrong. Please try again.";
}

async function ensureCustomerDocumentsWithRules(user, extra = {}) {
  const userRef = doc(db, COLLECTIONS.users, user.uid);
  const walletRef = doc(db, COLLECTIONS.wallets, user.uid);
  const userSnap = await getDoc(userRef);
  const walletSnap = await getDoc(walletRef);

  const baseProfile = {
    uid: user.uid,
    role: userSnap.exists() ? userSnap.data().role || "customer" : "customer",
    email: user.email,
    displayName: user.displayName || extra.displayName || "",
    phone: extra.phone || userSnap.data()?.phone || "",
    photoURL: user.photoURL || "",
    emailVerified: user.emailVerified,
    updatedAt: serverTimestamp(),
  };

  await setDoc(
    userRef,
    {
      ...baseProfile,
      createdAt: userSnap.exists() ? userSnap.data().createdAt || serverTimestamp() : serverTimestamp(),
    },
    { merge: true },
  );

  if (!walletSnap.exists()) {
    await setDoc(walletRef, {
      userId: user.uid,
      currency: "NGN",
      balance: 0,
      availableBalance: 0,
      lockedBalance: 0,
      status: "active",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }
}

async function ensureCustomerDocuments(user, extra = {}) {
  const profile = {
    displayName: extra.displayName || user.displayName || "",
    phone: extra.phone || "",
    email: user.email || extra.email || "",
    photoURL: user.photoURL || "",
  };

  try {
    const ensureCustomerAccount = httpsCallable(functions, "ensureCustomerAccount");
    await ensureCustomerAccount({ profile });
    return true;
  } catch (error) {
    console.warn("Cloud account setup unavailable; trying client setup.", error);
  }

  try {
    await ensureCustomerDocumentsWithRules(user, extra);
    return true;
  } catch (error) {
    console.warn("Client account setup failed.", error);
    return false;
  }
}

async function finishAuth(user, successMessage = "Welcome back. Redirecting...", extra = {}) {
  const profileReady = await ensureCustomerDocuments(user, extra);
  showMessage(
    profileReady
      ? successMessage
      : "You are signed in. Account details will finish syncing after setup is refreshed.",
    "success",
  );
  window.location.href = nextUrl;
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showPanel(tab.dataset.authTab));
});

getRedirectResult(auth)
  .then(async (result) => {
    if (!result?.user) return;
    authRedirectStarted = true;
    await finishAuth(result.user, "Google sign-in successful. Redirecting...");
  })
  .catch((error) => {
    showMessage(friendlyError(error), "error");
  })
  .finally(() => {
    redirectResultChecked = true;
    if (currentAuthUser && params.get("next") && !authRedirectStarted) {
      finishAuth(currentAuthUser).catch((error) => showMessage(friendlyError(error), "error"));
    }
  });

googleButton?.addEventListener("click", async () => {
  setAuthBusy(true);
  showMessage("Opening Google sign-in...");
  explicitAuthFlow = true;

  try {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await signInWithPopup(auth, googleProvider);
    await finishAuth(cred.user, "Google sign-in successful. Redirecting...");
  } catch (error) {
    if (error?.code?.includes("popup-blocked") || error?.code?.includes("operation-not-supported-in-this-environment")) {
      showMessage("Redirecting to Google sign-in...", "info");
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    explicitAuthFlow = false;
    showMessage(friendlyError(error), "error");
  } finally {
    setAuthBusy(false);
  }
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormBusy(loginForm, true);
  showMessage("Signing you in...");
  explicitAuthFlow = true;

  try {
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;
    const remember = loginForm.remember.checked;

    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await finishAuth(cred.user);
  } catch (error) {
    explicitAuthFlow = false;
    showMessage(friendlyError(error), "error");
  } finally {
    setFormBusy(loginForm, false);
  }
});

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormBusy(signupForm, true);
  showMessage("Creating your account...");
  explicitAuthFlow = true;

  try {
    const displayName = signupForm.displayName.value.trim();
    const phone = signupForm.phone.value.trim();
    const email = signupForm.email.value.trim();
    const password = signupForm.password.value;
    const confirmPassword = signupForm.confirmPassword.value;

    if (password !== confirmPassword) {
      explicitAuthFlow = false;
      showMessage("Passwords do not match.", "error");
      return;
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await ensureCustomerDocuments(cred.user, { displayName, phone, email });
    await sendEmailVerification(cred.user);
    try {
      await addDoc(collection(db, COLLECTIONS.notifications), {
        userId: cred.user.uid,
        type: "account",
        title: "Welcome to Kandys Treats",
        message: "Your account and wallet are ready. Please verify your email address.",
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn("Welcome notification was not created.", error);
    }

    showMessage("Account created. We sent a verification link to your email.", "success");
    window.setTimeout(() => {
      window.location.href = nextUrl;
    }, 900);
  } catch (error) {
    explicitAuthFlow = false;
    showMessage(friendlyError(error), "error");
  } finally {
    setFormBusy(signupForm, false);
  }
});

forgotForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormBusy(forgotForm, true);
  showMessage("Sending password reset email...");

  try {
    const email = forgotForm.email.value.trim();
    await sendPasswordResetEmail(auth, email);
    showMessage("Password reset link sent. Check your inbox.", "success");
  } catch (error) {
    showMessage(friendlyError(error), "error");
  } finally {
    setFormBusy(forgotForm, false);
  }
});

onAuthStateChanged(auth, (user) => {
  currentAuthUser = user;
  const isAuthGate = window.location.pathname.endsWith("/auth.html");
  if (user && isAuthGate && params.get("next") && redirectResultChecked && !authRedirectStarted && !explicitAuthFlow) {
    authRedirectStarted = true;
    finishAuth(user).catch((error) => showMessage(friendlyError(error), "error"));
  }
});

if (params.get("mode") === "signup") {
  showPanel("signup");
} else if (params.get("mode") === "forgot") {
  showPanel("forgot");
} else if (window.location.pathname.endsWith("/login.html")) {
  window.location.href = buildAuthRedirect("account.html");
} else {
  showPanel("login");
}
