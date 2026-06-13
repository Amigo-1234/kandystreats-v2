importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCWDTVJgW5dqcBbnZRb6m_Yz-fB7flO9nU",
  authDomain: "kandystreat-840b1.firebaseapp.com",
  projectId: "kandystreat-840b1",
  messagingSenderId: "394965571986",
  appId: "1:394965571986:web:ce79a02096c2eb2f2b094b"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {

  console.log("Background message:", payload);

  self.registration.showNotification(payload.notification.title, {
  body: payload.notification.body,
  icon: "logo.png",
  badge: "logo.png"
});
});