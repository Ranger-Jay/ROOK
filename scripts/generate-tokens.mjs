import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const jsonPath = path.join(root, "design", "design-tokens.json");
const tokenDocument = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

function kebab(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

const groups = [
  ["Typography families", [
    ["font.family.display", "font-display"], ["font.family.ui", "font-ui"], ["font.family.mono", "font-mono"]
  ]],
  ["Typography roles", [
    ...["hero", "display", "h1", "h2", "h3", "cardTitle", "bodyLarge", "body", "bodySmall", "label", "caption", "telemetry", "demoTitle", "demoMetric", "demoState", "demoEssential"]
      .flatMap(role => ["size", "line", "weight", "tracking"].map(field => [`type.${role}.${field}`, `type-${kebab(role)}-${field}`]))
  ]],
  ["Core surfaces", [
    ["color.background.obsidian", "bg-obsidian"], ["color.background.citadel", "bg-citadel"],
    ["color.surface.default", "surface"], ["color.surface.elevated", "surface-elevated"],
    ["color.surface.raised", "surface-raised"], ["color.surface.glassSolid", "glass-solid"],
    ["color.surface.glass", "glass"], ["color.surface.overlay", "overlay"]
  ]],
  ["Borders and dividers", [
    ["color.border.subtle", "border-subtle"], ["color.border.default", "border-default"],
    ["color.border.strong", "border-strong"], ["color.border.divider", "divider"]
  ]],
  ["Text", [
    ["color.text.primary", "text-primary"], ["color.text.secondary", "text-secondary"],
    ["color.text.tertiary", "text-tertiary"], ["color.text.muted", "text-muted"],
    ["color.text.onBright", "text-on-bright"]
  ]],
  ["Intelligence / telemetry", [
    ["color.intelligence.signal", "cyan"], ["color.intelligence.bright", "cyan-bright"],
    ["color.intelligence.deep", "cyan-deep"]
  ]],
  ["AI / orchestration", [
    ["color.orchestration.royal", "violet"], ["color.orchestration.text", "violet-text"],
    ["color.orchestration.deep", "violet-deep"]
  ]],
  ["Human authority", [
    ["color.authority.gold", "gold"], ["color.authority.bright", "gold-bright"],
    ["color.authority.deep", "gold-deep"]
  ]],
  ["Incident", [
    ["color.incident.critical", "critical"], ["color.incident.severe", "severe"],
    ["color.incident.warning", "warning"]
  ]],
  ["Verified recovery", [
    ["color.recovery.verified", "verified"], ["color.recovery.mint", "recovery-mint"]
  ]],
  ["Semantic translucent surfaces", [
    ["color.semanticBackground.info", "info-bg"], ["color.semanticBackground.ai", "ai-bg"],
    ["color.semanticBackground.authority", "authority-bg"], ["color.semanticBackground.critical", "critical-bg"],
    ["color.semanticBackground.warning", "warning-bg"], ["color.semanticBackground.verified", "verified-bg"]
  ]],
  ["4px spacing system", [
    ...["0", "0-5", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24"].map(name => [`space.${name}`, `space-${name}`])
  ]],
  ["Shape", [
    ...["xs", "sm", "md", "lg", "xl", "2xl", "pill"].map(name => [`radius.${name}`, `radius-${name}`])
  ]],
  ["Elevation", [
    ...["1", "2", "3", "gate", "critical", "verified"].map(name => [`shadow.${name}`, `shadow-${name}`]),
    ["glow.opacity.low", "glow-opacity-low"], ["glow.opacity.medium", "glow-opacity-medium"], ["glow.opacity.high", "glow-opacity-high"]
  ]],
  ["Glass", [
    ["glass.blur", "glass-blur"], ["glass.saturate", "glass-saturate"], ["glass.borderOpacity", "glass-border-opacity"]
  ]],
  ["Motion", [
    ...["instant", "fast", "base", "slow", "panel", "sequence", "scan", "breathe"].map(name => [`motion.duration.${name}`, `duration-${name}`]),
    ...["standard", "enter", "exit"].map(name => [`motion.easing.${name}`, `ease-${name}`])
  ]],
  ["Layout", [
    ["layout.headerHeight", "header-height"], ["layout.sidebarWidth", "sidebar-width"],
    ["layout.sidebarCollapsed", "sidebar-collapsed"], ["layout.contentMax", "content-max"],
    ["layout.controlMinHeight", "control-min-height"]
  ]]
];

function tokenAt(tokenPath) {
  const token = tokenPath.split(".").reduce((current, key) => current?.[key], tokenDocument.rook);
  if (!token || !("$value" in token)) throw new Error(`Missing canonical token: ${tokenPath}`);
  return token;
}

function cssValue(token) {
  if (token.$type === "fontFamily") {
    return token.$value.map(name => /\s/.test(name) ? `"${name}"` : name).join(", ");
  }
  if (token.$type === "cubicBezier") return `cubic-bezier(${token.$value.join(", ")})`;
  return String(token.$value);
}

function collectLeafPaths(node, prefix = "") {
  if (node && typeof node === "object" && "$value" in node) return [prefix];
  return Object.entries(node ?? {}).flatMap(([key, value]) => collectLeafPaths(value, prefix ? `${prefix}.${key}` : key));
}

const mappedPaths = new Set(groups.flatMap(([, tokens]) => tokens.map(([tokenPath]) => tokenPath)));
const leafPaths = collectLeafPaths(tokenDocument.rook);
const unmapped = leafPaths.filter(tokenPath => !mappedPaths.has(tokenPath));
const missing = [...mappedPaths].filter(tokenPath => !leafPaths.includes(tokenPath));
if (unmapped.length || missing.length) {
  throw new Error(`Token mapping mismatch. Unmapped: ${unmapped.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`);
}

const header = `/*\n * GENERATED FILE - DO NOT EDIT DIRECTLY.\n * Canonical source: design/design-tokens.json v${tokenDocument.$extensions["com.rook"].version}\n * Run: npm run tokens:generate\n */`;

const variableBlocks = groups.map(([comment, tokens]) => {
  const declarations = tokens.map(([tokenPath, cssName]) => `  --rook-${cssName}: ${cssValue(tokenAt(tokenPath))};`).join("\n");
  return `  /* ${comment} */\n${declarations}`;
}).join("\n\n");

const designCss = `${header}\n:root {\n  color-scheme: dark;\n\n${variableBlocks}\n}\n\n@media (prefers-reduced-motion: reduce) {\n  *,\n  *::before,\n  *::after {\n    animation-duration: 1ms !important;\n    animation-iteration-count: 1 !important;\n    scroll-behavior: auto !important;\n    transition-duration: 1ms !important;\n  }\n}\n`;

const typeRoles = [
  ["hero", "display"], ["display", "display"], ["h1", "display"], ["h2", "display"], ["h3", "display"],
  ["cardTitle", "display"], ["bodyLarge", "ui"], ["body", "ui"], ["bodySmall", "ui"],
  ["label", "ui"], ["caption", "ui"], ["telemetry", "mono"], ["demoTitle", "display"],
  ["demoMetric", "mono"], ["demoState", "display"], ["demoEssential", "ui"]
];

const typographyCss = `${header}\n${typeRoles.map(([role, family]) => {
  const className = role.startsWith("demo") ? `.rook-${kebab(role)}` : `.rook-type-${kebab(role)}`;
  const lines = [
    `${className} {`,
    `  font-family: var(--rook-font-${family});`,
    `  font-size: var(--rook-type-${kebab(role)}-size);`,
    `  line-height: var(--rook-type-${kebab(role)}-line);`,
    `  font-weight: var(--rook-type-${kebab(role)}-weight);`,
    `  letter-spacing: var(--rook-type-${kebab(role)}-tracking);`
  ];
  if (role === "label") lines.push("  text-transform: uppercase;");
  lines.push("}");
  return lines.join("\n");
}).join("\n\n")}\n`;

const outputs = [
  [path.join(root, "src", "styles", "tokens.css"), designCss],
  [path.join(root, "src", "styles", "typography.css"), typographyCss]
];

if (process.argv.includes("--check")) {
  const stale = outputs.filter(([filePath, expected]) => !fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== expected);
  if (stale.length) {
    console.error(`Generated CSS is stale: ${stale.map(([filePath]) => path.relative(root, filePath)).join(", ")}`);
    process.exit(1);
  }
  console.log(`Token synchronization OK: ${leafPaths.length} canonical tokens, ${outputs.length} generated files.`);
} else {
  for (const [filePath, contents] of outputs) fs.writeFileSync(filePath, contents);
  console.log(`Generated ${outputs.map(([filePath]) => path.relative(root, filePath)).join(" and ")} from ${leafPaths.length} canonical JSON tokens.`);
}

