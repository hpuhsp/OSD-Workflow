import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  rollbackDelivery,
  startDelivery,
  approveDelivery,
  planDelivery,
  beginImplementation,
  parseArgs,
} from "../bin/osd-workflow-init.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cliPath = join(projectRoot, "bin", "osd-workflow-init.mjs");

function tempProject(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function run(...args) {
  return execFileSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
}

function setVerifyCommand(target, command = `${process.execPath} --version`) {
  const configPath = join(target, ".osd", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.commands.verify = command;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function createProject(prefix) {
  const target = tempProject(prefix);
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  return target;
}

// Helper: advance a delivery to a given stage via the CLI
function advanceTo(target, feature, stage) {
  run("start", feature, target, "--adapter", "fallback", "--mode", "standard", "--strategy", "tdd");
  if (stage === "specification") return;
  run("approve", feature, target);
  if (stage === "planning") return;
  run("plan", feature, target);
  if (stage === "implementation") return;
  run("implement", feature, target);
  if (stage === "verification") return;
  run("verify", feature, target);
  if (stage === "review") return;
  // archive not reached in these tests
}

// Test 1: Happy path - rollback from verification to planning
test("rollback returns to an earlier stage and records history", (t) => {
  const target = createProject("osd-rollback-happy-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");

  const feature = "happy-rollback";
  advanceTo(target, feature, "verification");

  // Verify we are at verification
  let status = JSON.parse(run("status", feature, target));
  assert.equal(status.stage, "verification");

  // Rollback to planning
  const output = run("rollback", feature, target, "--to", "planning");
  assert.match(output, /OSD rollback: happy-rollback verification -> planning/);

  // Verify state
  status = JSON.parse(run("status", feature, target));
  assert.equal(status.stage, "planning");
  assert.equal(status.status, "approved");

  // Read state.json to check history
  const statePath = join(target, ".osd", "changes", feature, "state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const lastHistory = state.history[state.history.length - 1];
  assert.equal(lastHistory.stage, "planning");
  assert.equal(lastHistory.status, "approved");
  assert.equal(lastHistory.rollback, true);
  assert.equal(lastHistory.from_stage, "verification");

  // Verify events.jsonl was written
  const eventsPath = join(target, ".osd", "changes", feature, "events.jsonl");
  const eventsContent = readFileSync(eventsPath, "utf8");
  assert.match(eventsContent, /"event_type":"rollback"/);
  assert.match(eventsContent, /"from_stage":"verification"/);
  assert.match(eventsContent, /"to_stage":"planning"/);
});

// Test 2: Reject same-stage rollback
test("rollback rejects same-stage target", (t) => {
  const target = createProject("osd-rollback-same-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");

  const feature = "same-stage";
  advanceTo(target, feature, "verification");

  const status = JSON.parse(run("status", feature, target));
  assert.equal(status.stage, "verification");

  assert.throws(
    () => run("rollback", feature, target, "--to", "verification"),
    /must be an earlier stage/,
  );
});

// Test 3: Reject forward rollback
test("rollback rejects later-stage target", (t) => {
  const target = createProject("osd-rollback-forward-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");

  const feature = "forward-rollback";
  advanceTo(target, feature, "planning");

  const status = JSON.parse(run("status", feature, target));
  assert.equal(status.stage, "planning");

  assert.throws(
    () => run("rollback", feature, target, "--to", "review"),
    /must be an earlier stage/,
  );
});

// Test 4: Reject rollback from complete (via archive)
test("rollback rejects rollback from completed delivery", (t) => {
  const target = createProject("osd-rollback-complete-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");
  setVerifyCommand(target);

  const feature = "complete-delivery";
  advanceTo(target, feature, "review");
  run("review", feature, target, "--result", "pass");
  run("archive", feature, target);

  assert.throws(
    () => run("rollback", feature, target, "--to", "planning"),
    /Cannot rollback a completed or archived delivery/,
  );
});

// Test 5: Reject invalid stage name
test("rollback rejects invalid stage name", (t) => {
  const target = createProject("osd-rollback-invalid-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");

  const feature = "invalid-stage";
  advanceTo(target, feature, "verification");

  assert.throws(
    () => run("rollback", feature, target, "--to", "bogus"),
    /Invalid target stage/,
  );
});

// Test 6: Rollback from blocked state works
test("rollback works from blocked state", (t) => {
  const target = createProject("osd-rollback-blocked-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");

  const feature = "blocked-rollback";

  // Use programmatic API to get into blocked state at verification
  startDelivery(
    { target, feature, type: "new_feature", mode: "standard", strategy: "tdd", adapter: "fallback" },
    { output() {} },
  );
  approveDelivery({ target, feature }, { output() {} });
  planDelivery({ target, feature }, { output() {} });
  beginImplementation({ target, feature }, { output() {} });

  // Manually set state to blocked at verification stage to simulate a failed verify
  const statePath = join(target, ".osd", "changes", feature, "state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  state.stage = "verification";
  state.status = "blocked";
  state.history.push({ stage: "verification", status: "blocked", at: new Date().toISOString() });
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");

  // Now rollback from blocked verification to planning
  const stateAfterRollback = rollbackDelivery(
    { target, feature, toStage: "planning" },
    { output() {} },
  );

  assert.equal(stateAfterRollback.stage, "planning");
  assert.equal(stateAfterRollback.status, "approved");

  const lastHistory = stateAfterRollback.history[stateAfterRollback.history.length - 1];
  assert.equal(lastHistory.rollback, true);
  assert.equal(lastHistory.from_stage, "verification");
});

// Test 7: parseArgs handles --to flag
test("parseArgs parses --to flag", () => {
  // --to as separate argument
  const opts1 = parseArgs(["rollback", "my-feature", "--to", "planning"]);
  assert.equal(opts1.command, "rollback");
  assert.equal(opts1.feature, "my-feature");
  assert.equal(opts1.toStage, "planning");

  // --to= form
  const opts2 = parseArgs(["rollback", "my-feature", "--to=specification"]);
  assert.equal(opts2.toStage, "specification");
});

// Test 8: rollback requires --to
test("rollback requires --to flag", (t) => {
  const target = createProject("osd-rollback-no-to-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  run("init", target, "--yes");

  assert.throws(
    () => run("rollback", "some-feature", target),
    /rollback requires --to/,
  );
});
