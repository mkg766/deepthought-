"use strict";

const crypto = require("node:crypto");

const PRICE_IN_PAISE = 12900;
const CURRENCY = "INR";
const DOWNLOAD_TOKEN_TTL_SECONDS = 24 * 60 * 60;

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay environment variables are not configured.");
  }
  return { keyId, keySecret };
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqualHex(left, right) {
  if (!/^[\da-f]{64}$/i.test(left) || !/^[\da-f]{64}$/i.test(right)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function createDownloadToken(orderId, paymentId, now = Date.now()) {
  const { keySecret } = getCredentials();
  const payload = Buffer.from(JSON.stringify({
    orderId,
    paymentId,
    expiresAt: Math.floor(now / 1000) + DOWNLOAD_TOKEN_TTL_SECONDS,
  })).toString("base64url");
  return `${payload}.${sign(payload, keySecret)}`;
}

function verifyDownloadToken(token, now = Date.now()) {
  const { keySecret } = getCredentials();
  if (typeof token !== "string") return null;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !safeEqualHex(sign(payload, keySecret), signature)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof data.orderId !== "string" ||
      typeof data.paymentId !== "string" ||
      !Number.isInteger(data.expiresAt) ||
      data.expiresAt <= Math.floor(now / 1000)
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function isValidCustomer(name, email) {
  return (
    typeof name === "string" &&
    name.trim().length >= 1 &&
    name.trim().length <= 100 &&
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

async function razorpayRequest(path, { method = "GET", body } = {}) {
  const { keyId, keySecret } = getCredentials();
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${authorization}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error("Razorpay request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function sendJson(res, status, data) {
  setNoStore(res);
  res.status(status).json(data);
}

function getRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = {
  CURRENCY,
  PRICE_IN_PAISE,
  createDownloadToken,
  getCredentials,
  getRequestBody,
  isSameOrigin,
  isValidCustomer,
  razorpayRequest,
  safeEqualHex,
  sendJson,
  setNoStore,
  sign,
  verifyDownloadToken,
};
