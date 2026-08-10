#!/usr/bin/env node

export * from "../lib/osd-core.mjs";

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../lib/osd-core.mjs";

// Compare resolved real paths: global installs via symlink/junction (npm install -g <dir>, npm link)
// expose the entry as a link while import.meta.url resolves to the target, so a plain string
// comparison would silently skip main execution.
const entry = process.argv[1] && resolve(process.argv[1]);
const isMain = entry && realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) process.exitCode = await run();
