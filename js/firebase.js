// ===========================
// Firebase Core
// ===========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    getMessaging
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";

// Firebase Config
const firebaseConfig = {

    apiKey: "AIzaSyCWDTVJgW5dqcBbnZRb6m_Yz-fB7flO9nU",

    authDomain: "kandystreat-840b1.firebaseapp.com",

    projectId: "kandystreat-840b1",

    storageBucket: "kandystreat-840b1.firebasestorage.app",

    messagingSenderId: "394965571986",

    appId: "1:394965571986:web:ce79a02096c2eb2f2b094b"

};

// Initialize
const app = initializeApp(firebaseConfig);

// Services
const db = getFirestore(app);

const auth = getAuth(app);

const messaging = getMessaging(app);

// Export
export {

    app,

    db,

    auth,

    messaging

};

