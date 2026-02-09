import { createServer, type Server } from "node:net";
import { EditorRegistry } from "../registry/editor-registry.js";
import type { EditorCommand } from "@revealui/editor-sdk";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

export class RpcServer {
  private server: Server | null = null;

  constructor(
    private registry: EditorRegistry,
    private socketPath: string,
  ) {}

  async start(): Promise<void> {
    this.server = createServer((socket) => {
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) {
            this.handleMessage(line.trim()).then((response) => {
              socket.write(JSON.stringify(response) + "\n");
            });
          }
        }
      });
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.socketPath, () => resolve());
      this.server!.on("error", reject);
    });
  }

  private async handleMessage(raw: string): Promise<JsonRpcResponse> {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(raw);
    } catch {
      return { jsonrpc: "2.0", id: 0, error: { code: -32700, message: "Parse error" } };
    }

    try {
      switch (request.method) {
        case "editor.list": {
          const editors = await this.registry.listAvailable();
          return { jsonrpc: "2.0", id: request.id, result: editors };
        }
        case "editor.execute": {
          const { editorId, command } = request.params as { editorId: string; command: EditorCommand };
          const adapter = this.registry.get(editorId);
          if (!adapter) return { jsonrpc: "2.0", id: request.id, error: { code: -32602, message: `Unknown editor: ${editorId}` } };
          const result = await adapter.execute(command);
          return { jsonrpc: "2.0", id: request.id, result };
        }
        case "editor.info": {
          const { editorId: id } = request.params as { editorId: string };
          const adapter = this.registry.get(id);
          if (!adapter) return { jsonrpc: "2.0", id: request.id, error: { code: -32602, message: `Unknown editor: ${id}` } };
          return { jsonrpc: "2.0", id: request.id, result: await adapter.getInfo() };
        }
        default:
          return { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: `Unknown method: ${request.method}` } };
      }
    } catch (error) {
      return { jsonrpc: "2.0", id: request.id, error: { code: -32603, message: error instanceof Error ? error.message : "Internal error" } };
    }
  }

  async stop(): Promise<void> {
    if (this.server) { this.server.close(); this.server = null; }
  }
}
