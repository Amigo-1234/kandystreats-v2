import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp
}from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
// =======================
// DOM Elements
// =======================

const addAddressBtn =
    document.getElementById("add-address-btn");

const modal =
    document.getElementById("address-modal");

const closeBtn =
    document.getElementById("close-address-modal");

const cancelBtn =
    document.getElementById("cancel-address");

const saveBtn =
    document.getElementById("save-address");

const addressLabel =
    document.getElementById("address-label");

const addressText =
    document.getElementById("address-text");

const addressList =
    document.getElementById("address-list");

const emptyState =
    document.getElementById("empty-state");

const toast =
    document.getElementById("toast");

const modalTitle =
document.getElementById("address-modal-title");

let editingAddressId = null; // Track the address being edited

    function showToast(message, success = true) {

    toast.textContent = message;

    toast.className =
success
? "toast show success"
: "toast show error";

    setTimeout(() => {

        toast.className = "";

    }, 3000);

}

addAddressBtn?.addEventListener("click", () => {

    editingAddressId = null;

    modalTitle.textContent = "Add Address";

    addressLabel.value = "";

    addressText.value = "";

    modal.classList.remove("hidden");

});

closeBtn?.addEventListener("click", () => {

    modal.classList.add("hidden");

});

cancelBtn?.addEventListener("click", () => {

    modal.classList.add("hidden");

});

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.replace("auth.html");

        return;

    }

    await loadAddresses();

});

// =======================
// Save Address
// =======================

saveBtn?.addEventListener("click", async () => {

    const label = addressLabel.value.trim();
    const address = addressText.value.trim();

    if (!label || !address) {

        showToast("Please fill in all fields.", false);

        return;

    }

    try {

        const user = auth.currentUser;

        if (!user) return;

        if (editingAddressId) {

            await updateDoc(

                doc(
                    db,
                    "users",
                    user.uid,
                    "addresses",
                    editingAddressId
                ),

                {
                    label,
                    address
                }

            );

            showToast("Address updated!");

        } else {

            await addDoc(

                collection(
                    db,
                    "users",
                    user.uid,
                    "addresses"
                ),

                {
                    label,
                    address,
                    isDefault:false,
                    createdAt:serverTimestamp()
                }

            );

            showToast("Address saved!");

        }

        editingAddressId = null;

        modal.classList.add("hidden");

        addressLabel.value = "";

        addressText.value = "";

        await loadAddresses();

    }

    catch(error){

        console.error(error);

        showToast("Something went wrong.", false);

    }

});

async function loadAddresses(){

    const user = auth.currentUser;

    if(!user) return;

    const snapshot = await getDocs(

        collection(
            db,
            "users",
            user.uid,
            "addresses"
        )

    );

    addressList.innerHTML = "";

    if(snapshot.empty){

        emptyState.style.display = "block";

        return;

    }

    emptyState.style.display = "none";

    snapshot.forEach((doc) => {

    const data = doc.data();

    addressList.innerHTML += `

    <div class="glass-card address-card" data-id="${doc.id}">

        <div class="address-header">

            <div class="address-title">

                <div class="address-icon">

                    <img src="icons/location.svg" alt="Location">

                </div>

                <div>

                    <h3>${data.label}</h3>

                    <p>${data.address}</p>

                </div>

            </div>

            ${
                data.isDefault
                    ? `<span class="default-badge">Default</span>`
                    : ""
            }

        </div>

        <div class="address-actions">

            <button
                class="edit-address"
                data-id="${doc.id}"
                data-label="${data.label}"
                data-address="${data.address}">

                <img src="icons/edit.svg" alt="">
                Edit

            </button>

            <button
                class="delete-address"
                data-id="${doc.id}">

                <img src="icons/trash.svg" alt="">
                Delete

            </button>

        </div>

    </div>

    `;

});

// =======================
// Delete Listeners
// =======================

document
.querySelectorAll(".delete-address")
.forEach(button => {

    button.addEventListener("click", () => {

        deleteAddress(button.dataset.id);

    });

});

// =======================
// Edit Listeners
// =======================

document
.querySelectorAll(".edit-address")
.forEach(button => {

    button.addEventListener("click", () => {

        editingAddressId = button.dataset.id;

        addressLabel.value = button.dataset.label;

        addressText.value = button.dataset.address;

        modalTitle.textContent = "Edit Address";

modal.classList.remove("hidden");

    });

});

} // <-- End of loadAddresses()


// =======================
// Delete Address
// =======================

async function deleteAddress(addressId){

    const user = auth.currentUser;

    if(!user) return;

    const confirmed = confirm(
        "Delete this address?"
    );

    if(!confirmed) return;

    try{

        await deleteDoc(

            doc(
                db,
                "users",
                user.uid,
                "addresses",
                addressId
            )

        );

        showToast("Address deleted!");

        await loadAddresses();

    }

    catch(error){

        console.error(error);

        showToast(
            "Unable to delete address.",
            false
        );

    }

}