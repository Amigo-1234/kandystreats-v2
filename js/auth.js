import {
    auth,
    db
} from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendEmailVerification,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut,
    updateProfile,
    reload,
    browserLocalPersistence,
    setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


await setPersistence(
    auth,
    browserLocalPersistence
);

// =======================
// DOM Elements
// =======================

// Tabs
const loginTab = document.getElementById("login-tab");
const registerTab = document.getElementById("register-tab");

// Forms
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

// Headings
const title = document.getElementById("auth-title");
const subtitle = document.getElementById("auth-subtitle");

// Password Toggle Buttons
const passwordToggles = document.querySelectorAll(".password-toggle");

const toast = document.getElementById("toast");

const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");

const forgotPassword =
    document.getElementById("forgot-password");

const googleLoginBtn =
    document.getElementById("google-login-btn");

const googleRegisterBtn =
    document.getElementById("google-register-btn");   


// =======================
// Switch Tabs
// =======================

loginTab.addEventListener("click", () => {

    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

    title.textContent = "Welcome Back";

    subtitle.textContent =
        "Sign in to continue ordering your favourite meals.";

});

registerTab.addEventListener("click", () => {

    registerTab.classList.add("active");
    loginTab.classList.remove("active");

    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");

    title.textContent = "Create Account";

    subtitle.textContent =
        "Join Kandys Treats and start ordering delicious meals.";

});

// =======================
// Password Toggle
// =======================

passwordToggles.forEach(button => {

    button.addEventListener("click", () => {

        const input = button.previousElementSibling;

        if (input.type === "password") {

            input.type = "text";

            button.querySelector("img").src =
                "icons/eye-off.svg";

        }

        else {

            input.type = "password";

            button.querySelector("img").src =
                "icons/eye.svg";

        }

    });

});

// =======================
// Register User
// =======================

registerForm?.addEventListener("submit", async (e) => {

    setLoading(registerBtn, "Creating Account...");

    e.preventDefault();

    const firstName =
        document.getElementById("first-name").value.trim();

    const lastName =
        document.getElementById("last-name").value.trim();

    const email =
        document.getElementById("register-email").value.trim();

    const phone =
        document.getElementById("register-phone").value.trim();

    const password =
        document.getElementById("register-password").value;

    const confirmPassword =
        document.getElementById("confirm-password").value;

    // Validation

    if (password !== confirmPassword) {

                showToast(
            "Passwords do not match.",
            "warning"
        );

        return;

    }

    try {

        // Create Firebase account

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = userCredential.user;

        // Update Firebase display name

        await updateProfile(user, {

            displayName:
                `${firstName} ${lastName}`

        });

        // Save profile to Firestore

await setDoc(
    doc(db, "users", user.uid),
    {

        // Identity
        uid: user.uid,

        firstName,

        lastName,

        fullName: `${firstName} ${lastName}`,

        email,

        phone,

        photoURL: "",

        // Account
        role: "customer",

        membership: "Classic",

        // Wallet & Rewards
        wallet: 0,

        rewardPoints: 0,

        coupons: 0,

        totalOrders: 0,

        totalSpent: 0,

        // Future Features
        favoriteItems: [],

        addresses: [],

        notifications: true,

        // Timestamp
        createdAt: serverTimestamp()

    }
);
        // Send verification email

        await sendEmailVerification(user);

        registerForm.reset();

        showToast(
        "Account created successfully! Check your email.",
        "success"
);

    }

    catch (error) {

    let message = "Something went wrong. Please try again.";

    switch (error.code) {

        case "auth/email-already-in-use":
            message = "An account with this email already exists.";
            break;

        case "auth/invalid-email":
            message = "Please enter a valid email address.";
            break;

        case "auth/weak-password":
            message = "Password should be at least 6 characters.";
            break;

        case "auth/network-request-failed":
            message = "Network error. Check your internet connection.";
            break;

    }

    showToast(message,"error");

    console.error(error);

}

finally{

    resetButton(registerBtn);

}

});

// =======================
// Login User
// =======================

loginForm?.addEventListener("submit", async (e) => {


    setLoading(loginBtn, "Signing In...");
    e.preventDefault();

    const email = document
        .getElementById("login-email")
        .value
        .trim();

    const password = document
        .getElementById("login-password")
        .value;

    try {

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = userCredential.user;

        // Refresh user data
        await reload(user);

        // Check email verification
        if (!user.emailVerified) {

            await signOut(auth);

            showToast(
            "Please verify your email.",
            "warning"
);

            return;

        }

        showToast("Welcome back! 🎉");

        // Redirect later
        window.location.href = "profile.html";

    }

    catch (error) {

        let message = "Unable to sign in.";

        switch (error.code) {

            case "auth/user-not-found":
                message = "No account found with this email.";
                break;

            case "auth/wrong-password":
                message = "Incorrect password.";
                break;

            case "auth/invalid-credential":
                message = "Incorrect email or password.";
                break;

            case "auth/invalid-email":
                message = "Invalid email address.";
                break;

            case "auth/network-request-failed":
                message = "Check your internet connection.";
                break;

        }

        showToast(message,"error");

        console.error(error);

    }

    finally{

    resetButton(loginBtn);

}

});

// =======================
// Toast Notification
// =======================

function showToast(message, type = "success") {

    toast.textContent = message;

    toast.className = "";

    toast.classList.add(type);

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 3500);

}

// =======================
// Button Loading State
// =======================

function setLoading(button, text) {

    button.disabled = true;

    button.dataset.originalText = button.innerHTML;

    button.innerHTML = `
        <span class="spinner"></span>
        ${text}
    `;
}

function resetButton(button) {

    button.disabled = false;

    button.innerHTML = button.dataset.originalText;

}

// =======================
// Forgot Password
// =======================

forgotPassword?.addEventListener("click", async (e) => {

    e.preventDefault();

    const email = document
        .getElementById("login-email")
        .value
        .trim();

    if (!email) {

        showToast(
            "Please enter your email first.",
            "warning"
        );

        return;

    }

    try {

        await sendPasswordResetEmail(auth, email);

        showToast(
            "Password reset email sent.",
            "success"
        );

    }

    catch (error) {

        let message =
            "Unable to send reset email.";

        switch (error.code) {

            case "auth/user-not-found":
                message =
                    "No account found with this email.";
                break;

            case "auth/invalid-email":
                message =
                    "Please enter a valid email.";
                break;

        }

        showToast(message, "error");

    }

});

// =======================
// Google Sign In
// =======================

// =======================
// Google Sign In
// =======================

const provider = new GoogleAuthProvider();

async function signInWithGoogle(button){

    try{

        setLoading(button,"Signing in...");

        const result =
    await signInWithPopup(auth, provider);

await reload(result.user);

const user = auth.currentUser;

console.log("Google User:", user);
console.log("Provider Data:", user.providerData);
console.log("Google Email:", user.email);



        
    const userRef = doc(db, "users", user.uid);

console.log("Google UID:", user.uid);
console.log("Google Email:", user.email);

const userSnap = await getDoc(userRef);

console.log("Document exists before create?", userSnap.exists());

if (!userSnap.exists()) {

    console.log("Creating Firestore document...");

    const names = (user.displayName || "").split(" ");

    await setDoc(userRef, {

        // Identity
        uid: user.uid,
        firstName: names[0] || "",
        lastName: names.slice(1).join(" ") || "",
        fullName: user.displayName || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
        photoURL: user.photoURL || "",

        // Account
        role: "customer",
        provider: "google",
        membership: "Classic",

        // Wallet
        wallet: 0,
        rewardPoints: 0,
        coupons: 0,
        totalOrders: 0,
        totalSpent: 0,

        // Future
        favoriteItems: [],
        addresses: [],
        notifications: true,

        createdAt: serverTimestamp()

    });

    console.log("Firestore document created.");
}



        showToast(
    `Welcome ${user.displayName || "back"}!`,
    "success"
);

setTimeout(() => {

    window.location.href = "profile.html";

},1200);


    }

    catch(error){

        console.error(error);

        let message = "Google Sign-In failed.";

        if(error.code === "auth/popup-closed-by-user"){

            message = "Google sign-in was cancelled.";

        }

        showToast(message,"error");

    }

    finally{

        resetButton(button);

    }

}

googleLoginBtn?.addEventListener("click",()=>{

    signInWithGoogle(googleLoginBtn);

});

googleRegisterBtn?.addEventListener("click",()=>{

    signInWithGoogle(googleRegisterBtn);

});

// =======================
// Auth State Listener
// =======================
onAuthStateChanged(auth, async (user) => {

    if (!user) return;

    await reload(user);

    const isGoogle =
        user.providerData.some(
            provider => provider.providerId === "google.com"
        );

    if (!isGoogle && !user.emailVerified) {

        return;

    }

    showToast(
        `Welcome back, ${user.displayName || "Customer"}!`,
        "success"
    );

    setTimeout(() => {

        window.location.replace("profile.html");

    },1200);

});