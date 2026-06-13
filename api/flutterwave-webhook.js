import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const signature = req.headers["verif-hash"];

    // 🔐 SECURITY CHECK
    if (!signature || signature !== process.env.FLUTTERWAVE_SECRET_HASH) {
      console.error("❌ Invalid Flutterwave signature");
      return res.status(401).send("Unauthorized");
    }

    const event = req.body;

    console.log("📥 Flutterwave event received:", event.event);
    console.log("📦 Payload:", JSON.stringify(event.data));

    // ✅ Accept only completed charges
    if (
      event.event !== "charge.completed" ||
      event.data?.status !== "successful"
    ) {
      console.log("⚠️ Ignored event:", event.event, event.data?.status);
      return res.status(200).send("Ignored");
    }

    const data = event.data;
    const orderId = data.tx_ref;

    if (!orderId) {
      console.error("❌ Missing tx_ref");
      return res.status(200).send("Missing tx_ref");
    }

    const orderRef = db.collection("orders").doc(orderId);
    const snap = await orderRef.get();

    if (!snap.exists) {
      console.error("❌ Order not found:", orderId);
      return res.status(200).send("Order not found");
    }

    // 🔁 Idempotency protection
    if (snap.data().paid === true) {
      console.log("🔁 Already processed:", orderId);
      return res.status(200).send("Already processed");
    }

    // ✅ MARK AS PAID
    await orderRef.update({
      paid: true,
      paymentProvider: "flutterwave",
      paymentRef: String(data.id),
      paymentType: data.payment_type || "bank_transfer",
      paymentStatus: "confirmed",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      lastStatusUpdateAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Flutterwave payment CONFIRMED:", orderId);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 Flutterwave webhook error:", err);
    return res.status(500).send("Webhook error");
  }
}