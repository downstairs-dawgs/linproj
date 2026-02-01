#!/usr/bin/env bun
/**
 * Checks that the installed Bun version meets the minimum requirement.
 * Run automatically via the preinstall hook.
 */

const REQUIRED = "1.3.8";

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

if (compareVersions(Bun.version, REQUIRED) < 0) {
  console.error(`Error: Bun ${REQUIRED}+ required (you have ${Bun.version})`);
  console.error("Run: bun upgrade");
  process.exit(1);
}
