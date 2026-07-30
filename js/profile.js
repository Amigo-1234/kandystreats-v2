import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    doc,
    getDoc,
    updateDoc
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

const toast = document.getElementById("toast");
    
    let currentUserData = null; // Store the current user data

    // =======================
// Toast
// =======================

function showToast(message, success = true) {

    toast.textContent = message;

    toast.className =
        success
            ? "show success"
            : "show error";

    setTimeout(() => {

        toast.className = "";

    }, 3000);

}

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

        profileName.textContent =
    data.firstName || "Customer";

profileFullName.textContent =
    fullName;

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
// Save Profile
// =======================

saveProfileBtn?.addEventListener("click", async () => {

    const firstName = editFirstName.value.trim();

    const lastName = editLastName.value.trim();

    const phone = editPhone.value.trim();

    if (!firstName || !lastName) {

        showToast("First name and last name are required.", false);

        return;

    }

    try {

        const user = auth.currentUser;

        if (!user) return;

        await updateDoc(
            doc(db, "users", user.uid),
            {
                firstName,
                lastName,
                fullName: `${firstName} ${lastName}`,
                phone
            }
            
        );

        profileName.textContent = firstName;

profileFullName.textContent = `${firstName} ${lastName}`;


        editModal.classList.add("hidden");

        // Update the profile page instantly
        profileName.textContent =
    currentUserData.firstName;

profileFullName.textContent =
    currentUserData.fullName;

        showToast("Profile updated successfully!");

    } catch (error) {

        console.error(error);

        showToast("Failed to update profile.", false);

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

        showToast("Unable to logout.", false);

    }

});