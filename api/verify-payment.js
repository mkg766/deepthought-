"use strict";

const {
  CURRENCY,
  PRICE_IN_PAISE,
  createDownloadToken,
  getCredentials,
  getRequestBody,
  isSameOrigin,
  razorpayRequest,
  safeEqualHex,
  sendJson,
  sign,
} = require("../lib/payment");

const ID_PATTERN = /^[A-Za-z0-9_]+$/;

module.exports = async function verifyPayment(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: "invalid_origin" });
  }

  const body = getRequestBody(req);
  const { orderId, paymentId, signature } = body || {};
  if (
    typeof orderId !== "string" ||
    !ID_PATTERN.test(orderId) ||
    typeof paymentId !== "string" ||
    !ID_PATTERN.test(paymentId) ||
    typeof signature !== "string"
  ) {
    return sendJson(res, 400, { error: "invalid_payment_details" });
  }

  try {
    const { keySecret } = getCredentials();
    const expected = sign(`${orderId}|${paymentId}`, keySecret);
    if (!safeEqualHex(expected, signature)) {
      return sendJson(res, 400, { error: "payment_verification_failed" });
    }

    let payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
    if (
      payment.order_id !== orderId ||
      payment.amount !== PRICE_IN_PAISE ||
      payment.currency !== CURRENCY
    ) {
      return sendJson(res, 400, { error: "payment_details_do_not_match_order" });
    }
    if (payment.status === "authorized") {
      payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, {
        method: "POST",
        body: { amount: PRICE_IN_PAISE, currency: CURRENCY },
      });
    }
    if (
      payment.order_id !== orderId ||
      payment.status !== "captured" ||
      payment.amount !== PRICE_IN_PAISE ||
      payment.currency !== CURRENCY
    ) {
      return sendJson(res, 400, { error: "payment_not_captured" });
    }

    return sendJson(res, 200, {
      downloadToken: createDownloadToken(orderId, paymentId),
    });
  } catch (error) {
    console.error("Razorpay payment verification failed.", error.status || error.message);
    return sendJson(res, 502, { error: "payment_verification_unavailable" });
  }
};
