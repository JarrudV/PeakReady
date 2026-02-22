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

function isAuthBypassEnabled() {
  return process.env.AUTH_BYPASS === "true";
}

function validateRuntimeEnv() {
  const requiredEnvVars = ["DATABASE_URL"];
  if (process.env.AUTH_BYPASS !== "true") {
    requiredEnvVars.push("REPL_ID", "SESSION_SECRET");
  }

  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  // Add specific messages for REPL_ID and SESSION_SECRET if they are missing
  // and AUTH_BYPASS is not enabled.
  if (missing.includes("REPL_ID") && process.env.AUTH_BYPASS !== "true") {
    const index = missing.indexOf("REPL_ID");
    missing[index] = "REPL_ID (or set AUTH_BYPASS=true)";
  }
  if (missing.includes("SESSION_SECRET") && process.env.AUTH_BYPASS !== "true") {
    const index = missing.indexOf("SESSION_SECRET");
    missing[index] = "SESSION_SECRET (or set AUTH_BYPASS=true)";
  }

  if (missing.length === 0) {
    return;
  }

  console.error("[deploy] Missing required environment variables:");
  for (const key of missing) {
    console.error(`[deploy] - ${key}`);
  }
  process.exit(1);
}

async function main() {
  validateRuntimeEnv();

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
