import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
    ),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const signature = req.headers["verif-hash"];

    if (!signature || signature !== process.env.FLUTTERWAVE_SECRET_HASH) {
      console.error("Invalid Flutterwave signature");
      return res.status(401).send("Unauthorized");
    }

    const event = req.body;
    console.info("Flutterwave event received:", {
      event: event.event,
      reference: event.data?.tx_ref || null,
      status: event.data?.status || null,
    });

    if (
      event.event !== "charge.completed" ||
      event.data?.status !== "successful"
    ) {
      console.info("Ignored Flutterwave event:", event.event, event.data?.status);
      return res.status(200).send("Ignored");
    }

    const data = event.data;
    const orderId = data.tx_ref;

    if (!orderId) {
      console.error("Missing tx_ref");
      return res.status(200).send("Missing tx_ref");
    }

    const orderRef = db.collection("orders").doc(orderId);
    const snap = await orderRef.get();

    if (!snap.exists) {
      console.error("Order not found:", orderId);
      return res.status(200).send("Order not found");
    }

    if (snap.data().paid === true) {
      console.info("Flutterwave payment already processed:", orderId);
      return res.status(200).send("Already processed");
    }

    await orderRef.update({
      paid: true,
      paymentProvider: "flutterwave",
      paymentRef: String(data.id),
      paymentType: data.payment_type || "bank_transfer",
      paymentStatus: "confirmed",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      lastStatusUpdateAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.info("Flutterwave payment confirmed:", orderId);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("Flutterwave webhook error:", err);
    return res.status(500).send("Webhook error");
  }
}
