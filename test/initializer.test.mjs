import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs } from "../bin/osd-workflow-init.mjs";

test("initializer accepts one positional target", () => {
  const options = parseArgs(["target-project", "--dry-run"]);
  assert.equal(options.dryRun, true);
  assert.ok(options.target.endsWith("target-project"));
});

test("initializer rejects multiple positional targets", () => {
  assert.throws(
    () => parseArgs(["first-target", "second-target", "--dry-run"]),
    /Specify the target only once/,
  );
});

test("initializer rejects mixed positional and target option", () => {
  assert.throws(
    () => parseArgs(["first-target", "--target", "second-target"]),
    /Specify the target only once/,
  );
});
