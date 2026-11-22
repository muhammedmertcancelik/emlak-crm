const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "payidar-tests-"));
const original = fs.readFileSync(path.join(__dirname, "../data/database.json"));
let failed = false;
try {
  for (const name of [
    "test_multitenant_security.js",
    "test_e2e_api.js",
    "test_hardening.js",
    "test_office.js",
    "test_frontend.js",
    "test_ui.js",
  ]) {
    const args =
      name === "test_hardening.js"
        ? ["--test", path.join(__dirname, name)]
        : [path.join(__dirname, name)];
    const result = spawnSync(process.execPath, args, {
      stdio: "inherit",
      env: {
        ...process.env,
        CRM_DATA_FILE: path.join(dir, name + ".json"),
        CRM_UPLOAD_DIR: path.join(dir, "uploads"),
        NODE_ENV: "test",
      },
    });
    if (result.status !== 0) {
      failed = true;
      break;
    }
  }
  if (
    !fs
      .readFileSync(path.join(__dirname, "../data/database.json"))
      .equals(original)
  )
    throw new Error("Gerçek veritabanı test sırasında değişti.");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
