import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { WorkerClient } from "../src/worker-client.ts";

// Runs the real Python worker (M0 deferral: crash recovery). Skipped when the development venv is absent.
const python = resolve(import.meta.dirname, "..", "..", "research-core", ".venv", "Scripts", "python.exe");
const available = existsSync(python);

type Internals = { child: { pid?: number; kill: () => boolean } | null };

test("the worker restarts after a crash, after a clean shutdown, and a replaced worker's late exit is ignored", { skip: !available && "no research-core venv" }, async () => {
  const workspace = mkdtempSync(join(tmpdir(), "trl-worker-test-"));
  const client = new WorkerClient(python, workspace);
  try {
    const first = await client.request<{ methods: string[] }>("core.capabilities", {});
    assert.ok(first.methods.includes("prop.evaluate"));

    // Crash: kill the process under the client, then ask again; a new worker must answer.
    const crashed = (client as unknown as Internals).child!;
    const crashedPid = crashed.pid;
    crashed.kill();
    await new Promise((done) => setTimeout(done, 300));
    const afterCrash = await client.request<{ methods: string[] }>("core.capabilities", {});
    assert.ok(afterCrash.methods.length > 0);
    assert.notEqual((client as unknown as Internals).child!.pid, crashedPid);

    // Stop, then request immediately: the stopped worker's exit event arrives after the new
    // worker has started and must neither clear it nor fail its request.
    await client.stop();
    const racing = client.request<{ methods: string[] }>("core.capabilities", {});
    const listed = await client.request<{ profiles: unknown[] }>("prop.list_profiles", {});
    assert.deepEqual(listed.profiles, []);
    assert.ok((await racing).methods.length > 0);
    await new Promise((done) => setTimeout(done, 300));
    assert.ok(client.isReady);
  } finally {
    await client.stop();
    rmSync(workspace, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); // Windows: the exiting worker briefly holds its cwd
  }
});
