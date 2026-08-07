import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cliPath = join(projectRoot, "bin", "osd-workflow-init.mjs");

function tempProject(prefix) { return mkdtempSync(join(tmpdir(), prefix)); }
function run(...args) { return execFileSync(process.execPath, [cliPath, ...args], { encoding: "utf8" }); }
function setup(target, feature) {
  writeFileSync(join(target, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }), "utf8");
  run("init", target, "--yes");
  run("start", feature, target, "--adapter", "fallback");
}

// Helper: construct fake keys that match detection patterns without tripping secret scanners
const fakeAwsKey = "AKI" + "AIOSFODNN7EXAMPLE";
const fakeOpenAiKey = "s" + "k-proj-" + "abcdefghijklmnopqrstuvwxyz123456";
const fakeGithubPat = "g" + "hp_" + "abcdefghijklmnopqrstuvwxyz1234567890";
const fakeJwt = "eyJh" + "bGciOiJIUzI1NiJ9.eyJz" + "dWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
const fakeSlack = "xox" + "b-" + "000000000000-000000000000-abcdefghijklmnopqrstuvwx";
const fakeStripe = "p" + "k_" + "abcdefghijklmnopqrstuvwxyz123456";

test("recordEvent rejects AWS access key in string value", (t) => {
  const target = tempProject("osd-sd-aws-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  setup(target, "sd-aws");
  assert.throws(
    () => run("event", "sd-aws", target, "--event", JSON.stringify({ notes: fakeAwsKey })),
    /prompts|credentials|secrets|tokens|source code|raw tool/,
  );
});

test("recordEvent rejects OpenAI key in string value", (t) => {
  const target = tempProject("osd-sd-oai-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  setup(target, "sd-oai");
  assert.throws(
    () => run("event", "sd-oai", target, "--event", JSON.stringify({ config: fakeOpenAiKey })),
    /prompts|credentials|secrets|tokens|source code|raw tool/,
  );
});

test("recordEvent rejects GitHub PAT in string value", (t) => {
  const target = tempProject("osd-sd-gh-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  setup(target, "sd-gh");
  assert.throws(
    () => run("event", "sd-gh", target, "--event", JSON.stringify({ auth: fakeGithubPat })),
    /prompts|credentials|secrets|tokens|source code|raw tool/,
  );
});

test("recordEvent accepts normal text values", (t) => {
  const target = tempProject("osd-sd-ok-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  setup(target, "sd-ok");
  const output = run("event", "sd-ok", target, "--event", JSON.stringify({ notes: "deploy completed successfully", user: "admin" }));
  assert.ok(output.includes("deploy completed"));
});

test("recordEvent rejects nested sensitive key name", (t) => {
  const target = tempProject("osd-sd-nest-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  setup(target, "sd-nest");
  assert.throws(
    () => run("event", "sd-nest", target, "--event", JSON.stringify({ env: { SECRET_KEY: "some-value" } })),
    /prompts|credentials|secrets|tokens|source code|raw tool/,
  );
});

test("recordEvent rejects JWT token in string value", (t) => {
  const target = tempProject("osd-sd-jwt-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  setup(target, "sd-jwt");
  assert.throws(
    () => run("event", "sd-jwt", target, "--event", JSON.stringify({ auth: fakeJwt })),
    /prompts|credentials|secrets|tokens|source code|raw tool/,
  );
});

test("recordEvent rejects PEM private key in string value", (t) => {
  const target = tempProject("osd-sd-pem-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  setup(target, "sd-pem");
  assert.throws(
    () => run("event", "sd-pem", target, "--event", JSON.stringify({ key: "-----BEGIN RSA PRIVATE KEY-----\\nMIIEpA..." })),
    /prompts|credentials|secrets|tokens|source code|raw tool/,
  );
});

test("recordEvent rejects Slack token in string value", (t) => {
  const target = tempProject("osd-sd-slk-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  setup(target, "sd-slk");
  assert.throws(
    () => run("event", "sd-slk", target, "--event", JSON.stringify({ data: fakeSlack })),
    /prompts|credentials|secrets|tokens|source code|raw tool/,
  );
});

test("recordEvent rejects Stripe publishable key in string value", (t) => {
  const target = tempProject("osd-sd-str-");
  t.after(() => rmSync(target, { recursive: true, force: true }));
  setup(target, "sd-str");
  assert.throws(
    () => run("event", "sd-str", target, "--event", JSON.stringify({ billing: fakeStripe })),
    /prompts|credentials|secrets|tokens|source code|raw tool/,
  );
});
