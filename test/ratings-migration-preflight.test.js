const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const scriptPath = path.join(root, "scripts/apply-ratings-comments-db.js");
const script = fs.readFileSync(scriptPath, "utf8");
const feature = "20261026221500_add_ratings_comments";
const previous = fs.readdirSync(path.join(root, "prisma/migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== feature).map((entry) => entry.name);

function finished(name) {
  return { migration_name: name, finished_at: new Date(), rolled_back_at: null };
}

async function preflight({ tables = ["Book", "User", "_prisma_migrations"], history = previous.map(finished) } = {}) {
  const state = { launches: 0, disconnected: false, errors: [], messages: [] };
  let reads = 0;
  const client = {
    async $queryRaw() {
      reads++;
      return reads === 1 ? tables.map((table_name) => ({ table_name })) : history;
    },
    async $disconnect() { state.disconnected = true; },
  };
  function load(name) {
    if (name === "@prisma/client") return { PrismaClient: class { constructor() { return client; } } };
    if (name === "node:child_process") return { spawnSync() { state.launches++; return { status: 0 }; } };
    return require(name);
  }
  load.resolve = require.resolve;
  const sandboxProcess = { execPath: process.execPath, env: {}, exitCode: 0 };
  await vm.runInNewContext(script, {
    require: load, __dirname: path.dirname(scriptPath), process: sandboxProcess,
    console: { log: (...parts) => state.messages.push(parts.join(" ")), error: (...parts) => state.errors.push(parts.join(" ")) },
  }, { filename: scriptPath });
  return { ...state, exitCode: sandboxProcess.exitCode };
}

test("migration preflight launches deploy only when the feature is the sole pending migration", async () => {
  const result = await preflight();
  assert.equal(result.launches, 1);
  assert.equal(result.exitCode, 0);
  assert.equal(result.disconnected, true);
});

test("migration preflight blocks unrelated pending team migrations", async () => {
  const result = await preflight({ history: previous.slice(1).map(finished) });
  assert.equal(result.launches, 0);
  assert.equal(result.exitCode, 1);
  assert.match(result.errors.join(" "), /Other team migrations are pending/);
});

test("migration preflight blocks unresolved failed migrations", async () => {
  const result = await preflight({ history: [
    ...previous.map(finished), { migration_name: "failed_migration", finished_at: null, rolled_back_at: null },
  ] });
  assert.equal(result.launches, 0);
  assert.equal(result.exitCode, 1);
  assert.match(result.errors.join(" "), /unresolved migration/);
});

test("migration preflight blocks preexisting feature tables without migration history", async () => {
  const result = await preflight({ tables: ["Book", "User", "_prisma_migrations", "Rating"] });
  assert.equal(result.launches, 0);
  assert.equal(result.exitCode, 1);
  assert.match(result.errors.join(" "), /already exists without this migration/);
});

test("migration preflight accepts an already installed feature without launching deploy", async () => {
  const result = await preflight({
    tables: ["Book", "User", "_prisma_migrations", "Rating", "Comment"],
    history: [...previous.map(finished), finished(feature)],
  });
  assert.equal(result.launches, 0);
  assert.equal(result.exitCode, 0);
  assert.match(result.messages.join(" "), /already installed/);
});
