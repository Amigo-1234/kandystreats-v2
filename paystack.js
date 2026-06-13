// paystack.js (NO MODULE, NO IMPORTS)

window.startPaystackPayment = function ({
  key,
  email,
  amount,
  orderId,
  metadata,
  onSuccess,
  onClose
}) {
  if (!window.PaystackPop) {
    alert("Paystack not loaded");
    return;
  }

  const handler = PaystackPop.setup({
    key,
    email,
    amount,
    currency: "NGN",
    ref: orderId,
    metadata,
    callback: function (response) {
      onSuccess(response.reference);
    },
    onClose: function () {
      onClose();
    }
  });

  handler.openIframe();
};