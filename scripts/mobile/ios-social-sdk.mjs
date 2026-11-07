#!/usr/bin/env node
// Adds the Discord Social SDK to the generated Xcode project (CI, after `tauri ios init`).
//
// Usage: node ios-social-sdk.mjs <src-tauri/gen/apple> <sdk dir>
// The SDK dir holds ios/discord_partner_sdk.xcframework (from the private sakura-sdk repo).
// Afterwards run `xcodegen generate` in <gen/apple> to rebuild the .xcodeproj.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// js-yaml is installed by `npm ci` (dependency of eslint).
const yaml = createRequire(import.meta.url)('js-yaml');

function fail(msg) {
  console.log(`::error::${msg}`);
  process.exit(1);
}

const [gen, sdk] = process.argv.slice(2);
if (!gen || !sdk) fail('usage: node ios-social-sdk.mjs <gen/apple> <sdk dir>');
const src = join(sdk, 'ios', 'discord_partner_sdk.xcframework');
if (!existsSync(src)) fail(`${src} introuvable`);

mkdirSync(join(gen, 'Frameworks'), { recursive: true });
cpSync(src, join(gen, 'Frameworks', 'discord_partner_sdk.xcframework'), { recursive: true });

const specPath = join(gen, 'project.yml');
const text = readFileSync(specPath, 'utf8');
const framework = 'Frameworks/discord_partner_sdk.xcframework';
const spec = yaml.load(text);
const entry = Object.entries(spec.targets ?? {}).find(([k]) => k.endsWith('_iOS'));
if (!entry) fail('project.yml : cible *_iOS introuvable');
const [name, target] = entry;

if ((target.dependencies ?? []).some((d) => d && d.framework === framework)) {
  console.log(`Discord Social SDK déjà présent dans ${name}`);
  process.exit(0);
}

// Text insertion (a YAML round trip would rewrite values such as `iOS: 15.0` → `15`).
const lines = text.split('\n');
const targetLine = lines.findIndex((l) => new RegExp(`^(\\s*)${name}:\\s*$`).test(l));
const targetIndent = lines[targetLine]?.match(/^\s*/)[0].length ?? -1;
let depsLine = -1;
for (let i = targetLine + 1; i < lines.length; i++) {
  const indent = lines[i].match(/^\s*/)[0].length;
  if (lines[i].trim() && indent <= targetIndent) break; // next target
  if (/^\s*dependencies:\s*$/.test(lines[i])) {
    depsLine = i;
    break;
  }
}
// Dynamic library: linked and copied into the app (AltStore / SideStore sign it with the app).
if (depsLine === -1) {
  const pad = ' '.repeat(targetIndent + 2);
  lines.splice(targetLine + 1, 0, `${pad}dependencies:`, `${pad}  - framework: ${framework}`, `${pad}    embed: true`);
} else {
  const item = lines.slice(depsLine + 1).find((l) => /^\s*- /.test(l));
  const pad = item ? item.match(/^\s*/)[0] : ' '.repeat(lines[depsLine].match(/^\s*/)[0].length + 2);
  lines.splice(depsLine + 1, 0, `${pad}- framework: ${framework}`, `${pad}  embed: true`);
}
const out = lines.join('\n');
const check = yaml.load(out).targets[name].dependencies ?? [];
if (!check.some((d) => d && d.framework === framework && d.embed === true)) fail('project.yml : insertion du framework ratée');
writeFileSync(specPath, out);
console.log(`Discord Social SDK ajouté à la cible ${name}`);
