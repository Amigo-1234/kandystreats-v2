import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// =======================
// DOM Elements
// =======================

const profileName =
    document.getElementById("profile-name");

const profileFullName =
    document.getElementById("profile-fullname");

const membership =
    document.getElementById("profile-membership");

const avatar =
    document.getElementById("profile-avatar");

const wallet =
    document.getElementById("wallet-balance");

const rewards =
    document.getElementById("reward-points");

const coupons =
    document.getElementById("coupon-count");

const orders =
    document.getElementById("orders-total");

const logoutBtn =
    document.getElementById("logout-btn");

// =======================
// Edit Profile
// =======================

const editProfileBtn =
    document.querySelector(".edit-profile-btn");

const editModal =
    document.getElementById("edit-profile-modal");

const closeModalBtn =
    document.getElementById("close-modal");

const cancelEditBtn =
    document.getElementById("cancel-edit");

const saveProfileBtn =
    document.getElementById("save-profile");

const editFirstName =
    document.getElementById("edit-first-name");

const editLastName =
    document.getElementById("edit-last-name");

const editPhone =
    document.getElementById("edit-phone");   
    
    let currentUserData = null; // Store the current user data

// =======================
// Load Profile
// =======================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

    window.location.replace("auth.html");

    return;

}

    try {

        const userRef = doc(db, "users", user.uid);

        const snap = await getDoc(userRef);

        if (!snap.exists()) {

            console.log("User document not found.");

            return;

        }

        const data = snap.data();

        currentUserData = data; // Store the current user data

      
        // -----------------------
        // Full Name
        // -----------------------

        const fullName =
            data.fullName ||
            user.displayName ||
            "Customer";

        profileName.textContent = fullName;

        profileFullName.textContent = fullName;

        // -----------------------
        // Membership
        // -----------------------

        membership.textContent =
            data.membership || "Classic";

        // -----------------------
        // Wallet
        // -----------------------

        wallet.textContent =
            `₦${Number(data.wallet || 0).toLocaleString()}`;

        // -----------------------
        // Rewards
        // -----------------------

        rewards.textContent =
            data.rewardPoints || 0;

        // -----------------------
        // Coupons
        // -----------------------

        coupons.textContent =
            data.coupons || 0;

        // -----------------------
        // Orders
        // -----------------------

        orders.textContent =
            data.totalOrders || 0;

        // -----------------------
        // Avatar
        // -----------------------

        avatar.src =
            data.photoURL ||
            user.photoURL ||
            "images/default-avatar.png";

    }

    catch (error) {

        console.error("Profile Error:", error);

    }

});

// =======================
// Open Edit Profile
// =======================

editProfileBtn?.addEventListener("click", () => {

    if (!currentUserData) return;

    editFirstName.value =
        currentUserData.firstName || "";

    editLastName.value =
        currentUserData.lastName || "";

    editPhone.value =
        currentUserData.phone || "";

    editModal.classList.remove("hidden");

});

// Close Modal

closeModalBtn?.addEventListener("click", () => {

    editModal.classList.add("hidden");

});

cancelEditBtn?.addEventListener("click", () => {

    editModal.classList.add("hidden");

});


// =======================
// Logout
// =======================

logoutBtn?.addEventListener("click", async () => {

    const confirmLogout =
        confirm("Are you sure you want to logout?");

    if (!confirmLogout) return;

    try {

        await signOut(auth);

        window.location.replace("auth.html");

    }

    catch (error) {

        console.error(error);

        alert("Unable to logout.");

    }

});