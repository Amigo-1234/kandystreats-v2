const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendOrderNotification = functions.firestore
  .document("orders/{orderId}")
  .onCreate(async (snap, context) => {

    const order = snap.data();
    const orderId = context.params.orderId;

    const tokensSnap = await admin.firestore().collection("adminTokens").get();

    const tokens = tokensSnap.docs.map(doc => doc.data().token);

    if (tokens.length === 0) return null;

    const payload = {
      notification: {
        title: "New Order Received 🛍",
        body: `You have a new order (#${orderId}) worth NGN ${order.total}`
      }
    };

    return admin.messaging().sendToDevice(tokens, payload);
  });