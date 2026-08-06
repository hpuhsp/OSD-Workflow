#!/usr/bin/env node

export * from "../lib/osd-core.mjs";

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../lib/osd-core.mjs";

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = await run();
