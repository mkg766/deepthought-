"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");

fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(path.join(root, "index.html"), path.join(output, "index.html"));
fs.cpSync(path.join(root, "assets"), path.join(output, "assets"), { recursive: true });
console.log("Prepared static website in public/.");
