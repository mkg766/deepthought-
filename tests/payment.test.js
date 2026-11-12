"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  PRICE_IN_PAISE,
  createDownloadToken,
  isValidCustomer,
  safeEqualHex,
  sign,
  verifyDownloadToken,
} = require("../lib/payment");

const originalKeyId = process.env.RAZORPAY_KEY_ID;
const originalSecret = process.env.RAZORPAY_KEY_SECRET;

test.before(() => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_example";
  process.env.RAZORPAY_KEY_SECRET = "test_secret_for_unit_tests";
});

test.after(() => {
  if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
  else process.env.RAZORPAY_KEY_ID = originalKeyId;
  if (originalSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
  else process.env.RAZORPAY_KEY_SECRET = originalSecret;
});

test("price is fixed at ₹129 in paise", () => {
  assert.equal(PRICE_IN_PAISE, 12900);
});

test("download tokens validate and expire", () => {
  const now = 1_800_000_000_000;
  const token = createDownloadToken("order_123", "pay_456", now);
  assert.deepEqual(verifyDownloadToken(token, now), {
    orderId: "order_123",
    paymentId: "pay_456",
    expiresAt: Math.floor(now / 1000) + 86400,
  });
  assert.equal(verifyDownloadToken(`${token}x`, now), null);
  assert.equal(verifyDownloadToken(token, now + 86401_000), null);
});

test("customer fields are validated", () => {
  assert.equal(isValidCustomer("Acer", "buyer@example.com"), true);
  assert.equal(isValidCustomer("", "buyer@example.com"), false);
  assert.equal(isValidCustomer("Acer", "not-an-email"), false);
});

test("payment signatures require valid hex and are compared safely", () => {
  const valid = sign("order_123|pay_456", process.env.RAZORPAY_KEY_SECRET);
  assert.equal(safeEqualHex(valid, valid), true);
  assert.equal(safeEqualHex(valid, crypto.randomBytes(32).toString("hex")), false);
  assert.equal(safeEqualHex(valid, "invalid"), false);
});

test("order endpoint requires the guide before creating a Razorpay order", async () => {
  const createOrder = require("../api/create-order");
  const guideExists = fs.existsSync(path.join(__dirname, "..", "private", "the-2d-story-method.pdf"));
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () => ({ id: "order_test_123", amount: 12900, currency: "INR" }),
    };
  };
  const headers = {};
  const response = {
    setHeader(name, value) { headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
  };

  try {
    await createOrder({
      method: "POST",
      headers: { origin: "https://example.com", host: "example.com" },
      body: { name: "Buyer", email: "buyer@example.com" },
    }, response);
    if (!guideExists) {
      assert.equal(response.statusCode, 503);
      assert.deepEqual(response.data, { error: "guide_delivery_not_configured" });
      assert.equal(requests.length, 0);
    } else {
      assert.equal(response.statusCode, 200);
      assert.equal(response.data.amount, 12900);
      assert.equal(response.data.currency, "INR");
      assert.equal(requests.length, 1);
      assert.equal(JSON.parse(requests[0].options.body).amount, 12900);
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("payment endpoint verifies capture before creating download token", async () => {
  const verifyPayment = require("../api/verify-payment");
  const signature = sign("order_123|pay_456", process.env.RAZORPAY_KEY_SECRET);
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    const data = requests.length === 1
      ? { order_id: "order_123", amount: 12900, currency: "INR", status: "authorized" }
      : { order_id: "order_123", amount: 12900, currency: "INR", status: "captured" };
    return { ok: true, json: async () => data };
  };
  const response = {
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
  };

  try {
    await verifyPayment({
      method: "POST",
      headers: { origin: "https://example.com", host: "example.com" },
      body: { orderId: "order_123", paymentId: "pay_456", signature },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(typeof response.data.downloadToken, "string");
    assert.equal(requests.length, 2);
    assert.match(requests[1].url, /\/payments\/pay_456\/capture$/);
  } finally {
    global.fetch = originalFetch;
  }
});
