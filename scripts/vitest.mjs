/**
 * Runs Vitest from the canonical project path.
 *
 * On Windows a shell can hand Node a lowercase drive letter ("c:\..."). Vitest
 * then loads itself twice, once as c: and once as C:, and every suite fails
 * with "Cannot read properties of undefined (reading 'config')". Starting it
 * from an upper-case drive path keeps one copy.
 *
 *   node scripts/vitest.mjs run [vitest args]
 */
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { join } from "node:path";

const canonical = (path) => path.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const cwd = canonical(realpathSync.native(process.cwd()));
const result = spawnSync(process.execPath, [join(cwd, "node_modules", "vitest", "vitest.mjs"), ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(result.status ?? 1);
