"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { sendJson, setNoStore, verifyDownloadToken } = require("../lib/payment");

const guidePath = path.join(process.cwd(), "private", "the-2d-story-method.pdf");

module.exports = function downloadGuide(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  let tokenData;
  try {
    tokenData = verifyDownloadToken(req.query?.token);
  } catch {
    return sendJson(res, 503, { error: "download_service_not_configured" });
  }
  if (!tokenData) {
    return sendJson(res, 403, { error: "invalid_or_expired_download_link" });
  }
  if (!fs.existsSync(guidePath)) {
    return sendJson(res, 503, { error: "guide_delivery_not_configured" });
  }

  setNoStore(res);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="the-2d-story-method.pdf"');
  return res.send(fs.readFileSync(guidePath));
};
