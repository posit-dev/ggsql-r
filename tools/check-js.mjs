import { spawnSync } from "node:child_process";
import { buildWidget, generatedAsset } from "../srcts/build-lib.mjs";

function runStep(label, command, args, hint) {
  console.log(label);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error("\nJS verification failed.");
    console.error(hint);
    process.exit(result.status ?? 1);
  }
}

async function main() {
  runStep(
    "Running JS typecheck...",
    "npm",
    ["run", "typecheck"],
    "Run `npm run typecheck` locally and fix the reported TypeScript errors.",
  );

  console.log("Rebuilding generated JS assets...");
  try {
    await buildWidget();
  } catch (_error) {
    console.error("\nJS verification failed.");
    console.error("Run `npm run build` locally and fix the build error before committing.");
    throw _error;
  }

  runStep(
    "Running JS tests...",
    "npm",
    ["run", "test"],
    "Run `npm run test` locally and fix the failing JS tests.",
  );

  const driftCheck = spawnSync(
    "git",
    ["diff", "--quiet", "--exit-code", "--", generatedAsset],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  if (driftCheck.status !== 0) {
    console.error(`\nGenerated asset drift detected in \`${generatedAsset}\`.`);
    console.error("To fix it:");
    console.error("  1. Run `npm run build`");
    console.error(`  2. Review the updated \`${generatedAsset}\``);
    console.error("  3. Commit the regenerated asset");
    console.error("\nDiff summary:");
    spawnSync("git", ["--no-pager", "diff", "--stat", "--", generatedAsset], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    process.exit(driftCheck.status ?? 1);
  }

  console.log("JS verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
