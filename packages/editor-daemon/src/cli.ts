#!/usr/bin/env node
import { resolve } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import { EditorRegistry } from "./registry/editor-registry.js";
import { ZedAdapter } from "./adapters/zed-adapter.js";
import { RpcServer } from "./server/rpc-server.js";

const SOCKET_DIR = resolve(homedir(), ".local", "share", "revealui");
const SOCKET_PATH = resolve(SOCKET_DIR, "editor.sock");

async function main() {
  mkdirSync(SOCKET_DIR, { recursive: true });
  const registry = new EditorRegistry();
  registry.register(new ZedAdapter());
  const server = new RpcServer(registry, SOCKET_PATH);

  const shutdown = async () => {
    await server.stop();
    await registry.disposeAll();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.start();
  console.log(`RevealUI Editor Daemon listening on ${SOCKET_PATH}`);
  console.log(`Registered editors: ${registry.listAll().join(", ")}`);
}

main().catch((error) => {
  console.error("Failed to start editor daemon:", error);
  process.exit(1);
});
