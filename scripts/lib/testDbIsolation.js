/**
 * FleetOS test database isolation — never write to production data.db from scripts.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const PRODUCTION_DB_PATH = path.resolve(__dirname, "..", "..", "data.db");

function getProductionDbPath() {
  return PRODUCTION_DB_PATH;
}

function isProductionDatabase(dbPath) {
  if (!dbPath) return false;
  return path.resolve(dbPath) === PRODUCTION_DB_PATH;
}

/**
 * Abort if a test script is about to use production data.db.
 */
function assertNotProductionDatabase(dbPath, scriptName) {
  const resolved = path.resolve(dbPath || process.env.FLEETOS_DB_PATH || "");
  if (isProductionDatabase(resolved)) {
    console.error(`[test-safety] ${scriptName}: refusing to use production data.db`);
    console.error(`[test-safety] Production path: ${PRODUCTION_DB_PATH}`);
    console.error("[test-safety] Set FLEETOS_DB_PATH to a temp database before requiring lib/db.");
    process.exit(1);
  }
}

/**
 * Warn when legacy DB_PATH env is set (lib/db ignores it).
 */
function warnIfLegacyDbPathEnv(scriptName) {
  const legacy = process.env.DB_PATH;
  if (!legacy) return;
  if (isProductionDatabase(legacy)) {
    console.warn(
      `[test-safety] ${scriptName}: process.env.DB_PATH points at production data.db (ignored — use FLEETOS_DB_PATH)`
    );
  } else {
    console.warn(
      `[test-safety] ${scriptName}: process.env.DB_PATH is set but lib/db only reads FLEETOS_DB_PATH`
    );
  }
}

function purgeDbFromRequireCache(extraPatterns = []) {
  const patterns = ["/lib/db.js", "/services/vehicleCenterService", ...extraPatterns];
  Object.keys(require.cache).forEach((key) => {
    if (patterns.some((p) => key.includes(p))) {
      delete require.cache[key];
    }
  });
}

/**
 * Create temp DB path, assign FLEETOS_DB_PATH, and verify not production.
 */
function prepareIsolatedTestDatabase(prefix, scriptName, cachePatterns = []) {
  warnIfLegacyDbPathEnv(scriptName);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const testDbPath = path.join(tmpDir, "test.db");
  process.env.FLEETOS_DB_PATH = testDbPath;
  assertNotProductionDatabase(testDbPath, scriptName);
  purgeDbFromRequireCache(cachePatterns);
  console.log(`[test-safety] ${scriptName}: isolated DB ${testDbPath}`);
  return { tmpDir, testDbPath };
}

function cleanupTestDatabase(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {}
}

module.exports = {
  getProductionDbPath,
  isProductionDatabase,
  assertNotProductionDatabase,
  warnIfLegacyDbPathEnv,
  prepareIsolatedTestDatabase,
  purgeDbFromRequireCache,
  cleanupTestDatabase,
};
