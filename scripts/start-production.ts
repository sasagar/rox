/**
 * Production Start Script
 *
 * Starts both backend and frontend services in a single process group.
 * Handles graceful shutdown when SIGTERM/SIGINT is received.
 *
 * Usage: bun run start
 */

import { spawn, type Subprocess } from "bun";
import { join } from "path";
import { Socket } from "net";

const ROOT_DIR = join(import.meta.dir, "..");

// Get the full path to the bun executable
// This is needed because systemd doesn't inherit PATH
const BUN_PATH = process.execPath;

interface ProcessInfo {
  name: string;
  process: Subprocess;
  cwd: string;
  command: string[];
}

const processes: ProcessInfo[] = [];

/**
 * Wait for a port to become available
 */
async function waitForPort(port: number, maxAttempts = 30): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const socket = new Socket();
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", () => {
          socket.destroy();
          resolve();
        });
        socket.once("error", reject);
        socket.connect(port, "127.0.0.1");
      });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return false;
}

/**
 * Start a subprocess and track it
 */
function startProcess(name: string, cwd: string, command: string[]): ProcessInfo {
  console.log(`🚀 Starting ${name}...`);

  const proc = spawn({
    cmd: command,
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      // Ensure NODE_ENV is set
      NODE_ENV: process.env.NODE_ENV || "production",
    },
  });

  const info: ProcessInfo = {
    name,
    process: proc,
    cwd,
    command,
  };

  processes.push(info);

  // Monitor process exit
  proc.exited.then((code) => {
    console.log(`⚠️  ${name} exited with code ${code}`);

    // If a process exits unexpectedly, shut down everything
    if (code !== 0 && code !== null) {
      console.error(`❌ ${name} crashed, initiating shutdown...`);
      shutdown(1);
    }
  });

  return info;
}

/**
 * Gracefully shutdown all processes
 */
async function shutdown(exitCode: number = 0): Promise<void> {
  console.log("\n🛑 Shutting down all services...");

  // Send SIGTERM to all processes
  for (const { name, process: proc } of processes) {
    try {
      proc.kill("SIGTERM");
      console.log(`   Sent SIGTERM to ${name}`);
    } catch {
      // Process may already be dead
    }
  }

  // Wait for processes to exit (with timeout)
  const timeout = setTimeout(() => {
    console.log("⚠️  Timeout waiting for processes, forcing kill...");
    for (const { process: proc } of processes) {
      try {
        proc.kill("SIGKILL");
      } catch {
        // Ignore
      }
    }
  }, 10000);

  // Wait for all processes
  await Promise.all(processes.map(({ process: proc }) => proc.exited));

  clearTimeout(timeout);
  console.log("✅ All services stopped");
  process.exit(exitCode);
}

// Handle shutdown signals
process.on("SIGTERM", () => {
  console.log("\n📥 Received SIGTERM");
  shutdown(0);
});

process.on("SIGINT", () => {
  console.log("\n📥 Received SIGINT");
  shutdown(0);
});

// Check if frontend should be started
const ENABLE_FRONTEND = process.env.ENABLE_FRONTEND !== "false";

// Get port configuration from environment
const BACKEND_PORT = process.env.PORT || "3000";
const FRONTEND_PORT = process.env.FRONTEND_PORT || "3001";

// Main startup sequence
async function main(): Promise<void> {
  console.log("═".repeat(50));
  console.log("🦊 Rox Production Server");
  console.log("═".repeat(50));
  console.log(`Environment: ${process.env.NODE_ENV || "production"}`);
  console.log(`Working directory: ${ROOT_DIR}`);
  console.log(`Bun executable: ${BUN_PATH}`);
  console.log(`Frontend enabled: ${ENABLE_FRONTEND}`);
  console.log("");

  const backendPortNum = parseInt(BACKEND_PORT, 10);
  const frontendPortNum = parseInt(FRONTEND_PORT, 10);

  // Start backend (API server)
  startProcess("Backend (API)", join(ROOT_DIR, "packages/backend"), [
    BUN_PATH,
    "run",
    "src/index.ts",
  ]);

  // Wait for backend to be ready
  const backendReady = await waitForPort(backendPortNum);
  if (!backendReady) {
    console.error("❌ Backend failed to start within timeout");
    await shutdown(1);
    return;
  }
  console.log(`✅ Backend ready on port ${BACKEND_PORT}`);

  if (ENABLE_FRONTEND) {
    // Start frontend (Waku)
    startProcess("Frontend (Waku)", join(ROOT_DIR, "packages/frontend"), [
      BUN_PATH,
      "run",
      "start",
    ]);

    // Wait for frontend to be ready
    const frontendReady = await waitForPort(frontendPortNum);
    if (!frontendReady) {
      console.error("❌ Frontend failed to start within timeout");
      await shutdown(1);
      return;
    }
    console.log(`✅ Frontend ready on port ${FRONTEND_PORT}`);
  }

  console.log("");
  console.log("═".repeat(50));
  console.log("✅ All services started");
  console.log(`   Backend:  http://localhost:${BACKEND_PORT}`);
  if (ENABLE_FRONTEND) {
    console.log(`   Frontend: http://localhost:${FRONTEND_PORT}`);
  }
  console.log("═".repeat(50));
  console.log("");
  console.log("Press Ctrl+C to stop all services");
}

main().catch((error) => {
  console.error("❌ Failed to start:", error);
  process.exit(1);
});
