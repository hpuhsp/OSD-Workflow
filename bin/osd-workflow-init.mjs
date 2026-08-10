#!/usr/bin/env node

export * from "../lib/osd-core.mjs";

import { resolve } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { run } from "../lib/osd-core.mjs";

function safeRealpath(p) { try { return realpathSync(p); } catch { return null; } }
const isMain =
  process.argv[1] &&
  safeRealpath(resolve(process.argv[1])) === safeRealpath(fileURLToPath(import.meta.url));
if (isMain) process.exitCode = await run();
