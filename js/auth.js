import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendEmailVerification,
    sendPasswordResetEmail,
    updateProfile,
    reload,
    signOut,
    onAuthStateChanged,
    browserLocalPersistence,
    setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Keep users signed in
await setPersistence(auth, browserLocalPersistence);

// =====================
// DOM ELEMENTS
// =====================

// Tabs
const loginTab = document.getElementById("login-tab");
const registerTab = document.getElementById("register-tab");

// Forms
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

// Headings
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");

// Login
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");

// Register
const firstName = document.getElementById("first-name");
const lastName = document.getElementById("last-name");
const registerEmail = document.getElementById("register-email");
const registerPhone = document.getElementById("register-phone");
const registerPassword = document.getElementById("register-password");
const confirmPassword = document.getElementById("confirm-password");
const registerBtn = document.getElementById("register-btn");

// Google
const googleLoginBtn = document.getElementById("google-login-btn");
const googleRegisterBtn = document.getElementById("google-register-btn");

// Forgot Password
const forgotPassword = document.getElementById("forgot-password");

// Toast
const toast = document.getElementById("toast");

// Password Toggle Buttons
const passwordToggles = document.querySelectorAll(".password-toggle");

// =====================
// SWITCH TABS
// =====================

loginTab.addEventListener("click", () => {

    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

    authTitle.textContent = "Welcome Back";
    authSubtitle.textContent =
        "Sign in to continue ordering your favourite meals.";

});

registerTab.addEventListener("click", () => {

    registerTab.classList.add("active");
    loginTab.classList.remove("active");

    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");

    authTitle.textContent = "Create Account";
    authSubtitle.textContent =
        "Join Kandy's Treats and start enjoying delicious meals.";

});

// =====================
// PASSWORD TOGGLE
// =====================

passwordToggles.forEach(toggle => {

    toggle.addEventListener("click", () => {

        const input =
            toggle.parentElement.querySelector("input");

        const icon =
            toggle.querySelector(".eye-icon");

        if (input.type === "password") {

            input.type = "text";
            icon.src = "icons/eye-off.svg";

        } else {

            input.type = "password";
            icon.src = "icons/eye.svg";

        }

    });

});

// =====================
// TOAST
// =====================

function showToast(message, success = true) {

    toast.textContent = message;

    toast.className = success
        ? "show success"
        : "show error";

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);

}

// =====================
// LOADING BUTTON
// =====================

function setLoading(button, text = "Please wait...") {

    button.disabled = true;

    button.dataset.originalText = button.innerHTML;

    button.innerHTML = text;

}

function resetButton(button) {

    button.disabled = false;

    button.innerHTML = button.dataset.originalText;

}


// =====================
// REGISTER
// =====================

registerForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const first = firstName.value.trim();
    const last = lastName.value.trim();
    const email = registerEmail.value.trim();
    const phone = registerPhone.value.trim();
    const password = registerPassword.value;
    const confirm = confirmPassword.value;

    if (
    !first ||
    !last ||
    !email ||
    !phone ||
    !password ||
    !confirm
) {

    showToast("Please fill in all fields.", false);
    return;

}

if (password !== confirm) {

    showToast("Passwords do not match.", false);
    return;

}

if (password.length < 6) {

    showToast(
        "Password must be at least 6 characters.",
        false
    );

    return;

}

setLoading(registerBtn);

try {

    const userCredential =
        await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

    const user = userCredential.user;

    await updateProfile(user, {
        displayName: `${first} ${last}`
    });

    await setDoc(doc(db, "users", user.uid), {

        uid: user.uid,

        firstName: first,
        lastName: last,

        fullName: `${first} ${last}`,

        email: user.email,

        phone: phone,

        photoURL: "",

        role: "customer",

        provider: "password",

        membership: "Classic Member",

        wallet: 0,

        rewardPoints: 0,

        coupons: [],

        totalOrders: 0,

        totalSpent: 0,

        favoriteItems: [],

        addresses: [],

        notifications: true,

        createdAt: serverTimestamp()

    });

    await sendEmailVerification(user);

    showToast(
        "Account created! Please verify your email."
    );

    registerForm.reset();

    resetButton(registerBtn);

    setTimeout(() => {

        loginTab.click();

    }, 1500);

} catch (error) {

    let message = "Something went wrong.";

    switch (error.code) {

        case "auth/email-already-in-use":
            message = "Email already exists.";
            break;

        case "auth/invalid-email":
            message = "Invalid email address.";
            break;

        case "auth/weak-password":
            message = "Password is too weak.";
            break;

        default:
            message = error.message;

    }

    showToast(message, false);

    resetButton(registerBtn);

}

});

// =====================
// LOGIN
// =====================

loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {

        showToast(
            "Please enter your email and password.",
            false
        );

        return;

    }

    setLoading(loginBtn);

    try {

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = userCredential.user;

        await reload(user);

        if (!user.emailVerified) {

            await signOut(auth);

            showToast(
                "Please verify your email before signing in.",
                false
            );

            resetButton(loginBtn);

            return;

        }

        showToast(
            `Welcome back, ${user.displayName}!`
        );

        loginForm.reset();

        resetButton(loginBtn);

        setTimeout(() => {

            window.location.href = "profile.html";

        }, 1200);

    } catch (error) {

        let message = "Unable to sign in.";

        switch (error.code) {

            case "auth/invalid-credential":
                message = "Incorrect email or password.";
                break;

            case "auth/user-not-found":
                message = "Account not found.";
                break;

            case "auth/wrong-password":
                message = "Incorrect password.";
                break;

            case "auth/too-many-requests":
                message = "Too many attempts. Try again later.";
                break;

            default:
                message = error.message;

        }

        showToast(message, false);

        resetButton(loginBtn);

    }

});

// =====================
// FORGOT PASSWORD
// =====================

forgotPassword.addEventListener("click", async (e) => {

    e.preventDefault();

    const email = loginEmail.value.trim();

    if (!email) {

        showToast(
            "Please enter your email address first.",
            false
        );

        return;

    }

    try {

        await sendPasswordResetEmail(auth, email);

        showToast(
            "Password reset email sent."
        );

    } catch (error) {

        let message = "Unable to send reset email.";

        switch (error.code) {

            case "auth/user-not-found":
                message = "No account found with that email.";
                break;

            case "auth/invalid-email":
                message = "Please enter a valid email address.";
                break;

            default:
                message = error.message;

        }

        showToast(message, false);

    }

});

// =====================
// GOOGLE SIGN IN
// =====================

const googleProvider = new GoogleAuthProvider();

googleLoginBtn.addEventListener("click", signInWithGoogle);
googleRegisterBtn.addEventListener("click", signInWithGoogle);

async function signInWithGoogle() {

    try {

        const result = await signInWithPopup(
            auth,
            googleProvider
        );

        const user = result.user;

        await reload(user);

        const userRef = doc(db, "users", user.uid);

        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {

            const names = (user.displayName || "").trim().split(" ");

            const first =
                names[0] || "";

            const last =
                names.slice(1).join(" ");

            await setDoc(userRef, {

                uid: user.uid,

                firstName: first,

                lastName: last,

                fullName: user.displayName || "",

                email: user.email,

                phone: user.phoneNumber || "",

                photoURL: user.photoURL || "",

                role: "customer",

                provider: "google",

                membership: "Classic Member",

                wallet: 0,

                rewardPoints: 0,

                coupons: [],

                totalOrders: 0,

                totalSpent: 0,

                favoriteItems: [],

                addresses: [],

                notifications: true,

                createdAt: serverTimestamp()

            });

        }

        showToast(
            `Welcome, ${user.displayName}!`
        );

        setTimeout(() => {

            window.location.href = "profile.html";

        }, 1200);

    } catch (error) {

        if (
            error.code ===
            "auth/popup-closed-by-user"
        ) {

            return;

        }

        showToast(
            error.message,
            false
        );

    }

}