import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync } from "node:fs";
import type { WorkerResponse } from "./types";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class WorkerClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<string, Pending>();
  private stdoutBuffer = "";
  private sequence = 0;
  private startPromise: Promise<void> | null = null;

  private readonly pythonExecutable: string;
  private readonly workspaceRoot: string;

  constructor(pythonExecutable: string, workspaceRoot: string) {
    this.pythonExecutable = pythonExecutable;
    this.workspaceRoot = workspaceRoot;
  }

  get isReady(): boolean {
    return this.child !== null && this.startPromise === null;
  }

  async ensureReady(): Promise<void> {
    await this.ensureStarted();
  }

  async request<T>(method: string, params: Record<string, unknown>, timeoutMs = 30_000): Promise<T> {
    await this.ensureReady();
    return this.send<T>(method, params, timeoutMs);
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    try {
      await this.request("core.shutdown", {}, 5_000);
    } catch {
      // A worker may already have stopped; force cleanup below.
    }
    this.terminate();
  }

  private send<T>(method: string, params: Record<string, unknown>, timeoutMs: number): Promise<T> {
    if (!this.child) return Promise.reject(new Error("Research worker is unavailable."));
    const requestId = `m0-${++this.sequence}`;
    const request = JSON.stringify({ protocol: 1, request_id: requestId, method, params });
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Research worker timed out while running ${method}.`));
        void this.send("core.cancel", { target_request_id: requestId }, 2_000).catch(() => this.terminate());
      }, timeoutMs);
      this.pending.set(requestId, { resolve: (value) => resolve(value as T), reject, timer });
      this.child?.stdin.write(`${request}\n`, "utf8", (error) => {
        if (error) {
          const pending = this.pending.get(requestId);
          if (pending) clearTimeout(pending.timer);
          this.pending.delete(requestId);
          reject(error);
        }
      });
    });
  }

  private async ensureStarted(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    if (this.child) return;
    if (!this.pythonExecutable.trim()) {
      throw new Error("Set the Python 3.14.7 virtual-environment executable in Trading Research Lab settings before running research.");
    }
    // The first run has no worker-data directory yet. Create only the plugin's
    // own local workspace before asking Node to use it as the child-process cwd.
    mkdirSync(this.workspaceRoot, { recursive: true });
    const child = spawn(this.pythonExecutable, ["-m", "trading_research_core", "--workspace-root", this.workspaceRoot], {
      cwd: this.workspaceRoot,
      windowsHide: true,
      stdio: "pipe",
    });
    this.child = child;
    this.stdoutBuffer = "";
    // Events from a worker that has already been replaced (after a timeout, stop, or crash) must not
    // touch the current worker or its pending requests.
    child.stdout.on("data", (chunk: Buffer) => { if (this.child === child) this.consumeStdout(chunk.toString("utf8")); });
    child.stderr.on("data", (chunk: Buffer) => console.error("[Trading Research Lab worker]", chunk.toString("utf8")));
    child.on("error", (error) => {
      if (this.child !== child) return;
      this.child = null;
      this.failAll(error);
    });
    child.on("exit", (code) => {
      if (this.child !== child) return;
      this.child = null;
      this.failAll(new Error(`Research worker exited with code ${code ?? "unknown"}.`));
    });
    this.startPromise = this.send("core.capabilities", {}, 5_000).then(() => undefined).finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  private consumeStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split("\n");
    this.stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let response: WorkerResponse<unknown>;
      try {
        response = JSON.parse(line) as WorkerResponse<unknown>;
      } catch {
        this.failAll(new Error("Research worker emitted an invalid protocol response."));
        return;
      }
      if (response.request_id === null) continue;
      const pending = this.pending.get(response.request_id);
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pending.delete(response.request_id);
      if (response.success) pending.resolve(response.result);
      else pending.reject(new Error(`${response.error.code}: ${response.error.message}`));
    }
  }

  private failAll(error: Error): void {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }

  private terminate(): void {
    const child = this.child;
    this.child = null;
    this.failAll(new Error("Research worker was stopped."));
    child?.kill();
  }
}
