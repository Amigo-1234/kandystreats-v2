import admin from "firebase-admin";
import crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  const receivedAt = admin.firestore.FieldValue.serverTimestamp();
  let logRef;

  try {
    logRef = await db.collection("payment_logs").add({
      provider: "paystack",
      verified: false,
      receivedAt,
      payload: req.body,
    });

    const signature = req.headers["x-paystack-signature"];
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== signature) {
      await logRef.update({
        verified: false,
        reason: "Invalid signature",
      });
      return res.status(401).send("Invalid signature");
    }

    const event = req.body;

    await logRef.update({
      verified: true,
      event: event.event,
    });

    if (event.event !== "charge.success") {
      await logRef.update({ reason: "Ignored event type" });
      return res.status(200).send("Ignored");
    }

    const orderId =
      event.data.metadata?.orderId ||
      event.data.metadata?.custom_fields?.find(
        f => f.variable_name === "orderId"
      )?.value;

    if (!orderId) {
      await logRef.update({ reason: "Missing orderId" });
      return res.status(200).send("Missing orderId");
    }

    await logRef.update({ orderId });

    const ref = db.collection("orders").doc(orderId);
    const snap = await ref.get();

    if (!snap.exists) {
      await logRef.update({ reason: "Order not found" });
      return res.status(200).send("Order not found");
    }

    if (snap.data().paid === true) {
      await logRef.update({ reason: "Already processed" });
      return res.status(200).send("Already processed");
    }

    await ref.update({
      paid: true,
      paymentProvider: "paystack",
      paymentRef: event.data.reference,
      paymentStatus: "confirmed",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logRef.update({
      success: true,
      reason: null,
    });

    console.log("✅ Paystack payment confirmed:", orderId);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 Paystack webhook error:", err);

    if (logRef) {
      await logRef.update({
        success: false,
        reason: err.message,
      });
    }

    return res.status(500).send("Webhook error");
  }
}