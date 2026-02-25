import { build, context } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const targetArg = getArgValue(args, "--target") ?? "all";
const targets = targetArg === "all" ? ["chrome", "firefox"] : [targetArg];
const allowedTargets = new Set(["chrome", "firefox"]);

for (const target of targets) {
  if (!allowedTargets.has(target)) {
    throw new Error(`Unsupported target "${target}". Use chrome, firefox, or all.`);
  }
}

const root = resolve(process.cwd());
const manifestBasePath = resolve(root, "src/manifest.base.json");
const staticAssets = [
  { from: "src/popup/popup.html", to: "popup/popup.html" },
  { from: "src/popup/popup.css", to: "popup/popup.css" }
];

const entryPoints = {
  background: "src/background.ts",
  "content/index": "src/content/index.ts",
  "content/bluera-probe": "src/content/bluera-probe.ts",
  "popup/popup": "src/popup/popup.ts"
};

async function readManifestBase() {
  const raw = await readFile(manifestBasePath, "utf8");
  return JSON.parse(raw);
}

function buildManifestForTarget(baseManifest, target) {
  const manifest = structuredClone(baseManifest);

  if (target === "chrome") {
    manifest.background = {
      service_worker: "background.js"
    };
    delete manifest.browser_specific_settings;
    return manifest;
  }

  manifest.background = {
    scripts: ["background.js"]
  };
  manifest.browser_specific_settings = {
    gecko: {
      id: "better-caesar@local.dev",
      strict_min_version: "128.0"
    }
  };

  return manifest;
}

function bundleConfigForTarget(target) {
  const outdir = resolve(root, "dist", target);

  return {
    entryPoints,
    outdir,
    bundle: true,
    format: "iife",
    target: target === "chrome" ? "chrome120" : "firefox128",
    sourcemap: true,
    entryNames: "[dir]/[name]",
    logLevel: "info"
  };
}

async function copyStaticFiles(outdir) {
  await mkdir(resolve(outdir, "popup"), { recursive: true });
  for (const asset of staticAssets) {
    await cp(resolve(root, asset.from), resolve(outdir, asset.to));
  }
}

async function writeManifest(outdir, manifest) {
  await writeFile(
    resolve(outdir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

if (watch) {
  if (targets.length !== 1) {
    throw new Error("Watch mode supports a single target. Use --target chrome or --target firefox.");
  }

  const target = targets[0];
  const outdir = resolve(root, "dist", target);
  const manifest = buildManifestForTarget(await readManifestBase(), target);
  const config = bundleConfigForTarget(target);
  const ctx = await context(config);

  await rm(outdir, { recursive: true, force: true });
  await copyStaticFiles(outdir);
  await writeManifest(outdir, manifest);
  await ctx.watch();
  console.log(`Watching extension files for ${target}...`);
} else {
  const manifestBase = await readManifestBase();

  for (const target of targets) {
    const outdir = resolve(root, "dist", target);
    const manifest = buildManifestForTarget(manifestBase, target);
    const config = bundleConfigForTarget(target);

    await rm(outdir, { recursive: true, force: true });
    await build(config);
    await copyStaticFiles(outdir);
    await writeManifest(outdir, manifest);
  }
}

function getArgValue(allArgs, key) {
  const index = allArgs.indexOf(key);
  if (index === -1 || index + 1 >= allArgs.length) return null;
  return allArgs[index + 1];
}
