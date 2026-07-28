import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "auth.html";

        return;

    }

    const docRef = doc(db, "users", user.uid);

    const snap = await getDoc(docRef);

    if (!snap.exists()) return;

    const data = snap.data();

    document.getElementById("profile-name").textContent =
        data.fullName;

    document.getElementById("membership").textContent =
        data.membership;

    document.getElementById("wallet").textContent =
        `₦${data.wallet.toFixed(2)}`;

    document.getElementById("rewards").textContent =
        data.rewardPoints;

    document.getElementById("coupons").textContent =
        data.coupons;

});