// paystack.js (NO MODULE, NO IMPORTS)

window.startPaystackPayment = function ({
  key,
  email,
  amount,
  orderId,
  reference,
  metadata,
  onSuccess,
  onClose
}) {
  if (!window.PaystackPop) {
    alert("Paystack not loaded");
    return;
  }

  const ref = reference || orderId;
  if (!ref) {
    alert("Payment reference missing");
    return;
  }

  const handler = PaystackPop.setup({
    key,
    email,
    amount,
    currency: "NGN",
    ref,
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
