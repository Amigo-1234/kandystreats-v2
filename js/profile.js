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