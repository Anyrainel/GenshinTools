const path = require("node:path");
const fs = require("node:fs");
const { parse } = require("jsonc-parser");
const errors = [];
const config = parse(
  fs.readFileSync(path.join(__dirname, "tsconfig.app.json"), "utf8"),
  errors
);
if (errors.length)
  throw new Error("Invalid compiler configuration for dependency resolution");
const { paths } = config.compilerOptions;

// Read compiler aliases as data; SWC parses dependencies without the old TS API.
module.exports = {
  resolve: {
    alias: Object.fromEntries(
      Object.entries(paths).map(([key, values]) => [
        key.replace(/\/\*$/, ""),
        path.resolve(__dirname, values[0].replace(/\/\*$/, "")),
      ])
    ),
  },
};
