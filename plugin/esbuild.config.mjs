import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "node:module";

const production = process.argv[2] === "production";
const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtinModules],
  platform: "node",
  format: "cjs",
  target: "es2021",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  // MQL5 files offered on the Help page are embedded as text (no network, no separate assets).
  loader: { ".mqh": "text", ".mq5": "text" },
  minify: production,
});

if (production) {
  await context.rebuild();
  process.exit(0);
}
await context.watch();
