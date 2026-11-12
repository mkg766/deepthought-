"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  CURRENCY,
  PRICE_IN_PAISE,
  getCredentials,
  getRequestBody,
  isSameOrigin,
  isValidCustomer,
  razorpayRequest,
  sendJson,
} = require("../lib/payment");

const guidePath = path.join(process.cwd(), "private", "the-2d-story-method.pdf");

module.exports = async function createOrder(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: "invalid_origin" });
  }
  if (!fs.existsSync(guidePath)) {
    return sendJson(res, 503, { error: "guide_delivery_not_configured" });
  }

  const body = getRequestBody(req);
  if (!body || !isValidCustomer(body.name, body.email)) {
    return sendJson(res, 400, { error: "invalid_customer_details" });
  }

  try {
    const { keyId } = getCredentials();
    const order = await razorpayRequest("/orders", {
      method: "POST",
      body: {
        amount: PRICE_IN_PAISE,
        currency: CURRENCY,
        receipt: `story_${require("node:crypto").randomUUID().replaceAll("-", "").slice(0, 24)}`,
        notes: {
          product: "The 2D Story Method",
          customer_name: body.name.trim(),
          customer_email: body.email.trim().toLowerCase(),
        },
      },
    });

    return sendJson(res, 200, {
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Razorpay order creation failed.", error.status || error.message);
    return sendJson(res, 502, { error: "order_creation_failed" });
  }
};
