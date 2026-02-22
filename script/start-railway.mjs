import { spawn } from "node:child_process";

function runCommand(command, args, env = process.env) {
  const executable =
    process.platform === "win32" && command === "npm" ? "npm.cmd" : command;

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: "inherit",
      env,
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${executable} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function main() {
  const runMigrations = process.env.RUN_DB_PUSH_ON_START === "true";

  if (runMigrations) {
    if (!process.env.DATABASE_URL) {
      console.error("[deploy] RUN_DB_PUSH_ON_START=true but DATABASE_URL is not set.");
      process.exit(1);
    }

    console.log("[deploy] Running migrations (drizzle-kit push)...");
    await runCommand("npm", ["run", "db:push"]);
    console.log("[deploy] Migrations completed.");
  } else {
    console.log("[deploy] Skipping migrations (set RUN_DB_PUSH_ON_START=true to enable).");
  }

  console.log("[deploy] Starting application...");
  await runCommand("node", ["dist/index.cjs"], {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "production",
  });
}

main().catch((error) => {
  console.error("[deploy] Startup failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
