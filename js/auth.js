import {
    auth,
    db
} from "./firebase.js";

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
}
from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
// Login Form
const form = document.getElementById("login-form");

if (form) {

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email =
            document
            .getElementById("login-email")
            .value
            .trim();

        const password =
            document
            .getElementById("login-password")
            .value;

        try {

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            alert("Login successful 🎉");

            window.location.href = "profile.html";

        }

        catch (err) {

            alert(err.message);

        }

    });

}

// Already logged in?
onAuthStateChanged(auth, (user) => {

    if (!user) return;

    console.log("Logged in:", user.email);

});


const loginTab = document.getElementById("login-tab");
const registerTab = document.getElementById("register-tab");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const title = document.getElementById("auth-title");
const subtitle = document.getElementById("auth-subtitle");

loginTab?.addEventListener("click", () => {

    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

    title.textContent = "Welcome Back";

    subtitle.textContent =
        "Sign in to continue ordering your favourite meals.";

});

registerTab?.addEventListener("click", () => {

    registerTab.classList.add("active");
    loginTab.classList.remove("active");

    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");

    title.textContent = "Create Account";

    subtitle.textContent =
        "Join Kandys Treats and start ordering delicious meals.";

});