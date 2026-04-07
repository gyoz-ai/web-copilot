// Post-build script: generate .lproj/InfoPlist.strings for Safari app targets
// and patch project.pbxproj to register them.
// Run after: xcrun safari-web-extension-converter
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

// ── Locale → translated app display name ────────────────────────────────────
// CFBundleName stays "gyoza" (brand). CFBundleDisplayName gets localised.
const SAFARI_LOCALES: Record<string, { displayName: string }> = {
  en: { displayName: "gyoza" },
  "pt-BR": { displayName: "gyoza" },
  "pt-PT": { displayName: "gyoza" },
  es: { displayName: "gyoza" },
  fr: { displayName: "gyoza" },
  de: { displayName: "gyoza" },
  it: { displayName: "gyoza" },
  nl: { displayName: "gyoza" },
  pl: { displayName: "gyoza" },
  ru: { displayName: "gyoza" },
  uk: { displayName: "gyoza" },
  el: { displayName: "gyoza" },
  tr: { displayName: "gyoza" },
  ar: { displayName: "gyoza" },
  hi: { displayName: "gyoza" },
  ja: { displayName: "gyoza" },
  ko: { displayName: "gyoza" },
  "zh-Hans": { displayName: "gyoza" },
  "zh-Hant": { displayName: "gyoza" },
  th: { displayName: "gyoza" },
  vi: { displayName: "gyoza" },
  id: { displayName: "gyoza" },
  ms: { displayName: "gyoza" },
  sv: { displayName: "gyoza" },
  da: { displayName: "gyoza" },
  fi: { displayName: "gyoza" },
  nb: { displayName: "gyoza" },
  cs: { displayName: "gyoza" },
  ro: { displayName: "gyoza" },
  hu: { displayName: "gyoza" },
  he: { displayName: "gyoza" },
};

const SAFARI_APP_ROOT = join(import.meta.dirname!, "..", "safari-app", "gyoza");

const TARGETS = ["Shared (App)/Resources", "iOS (App)", "macOS (App)"] as const;

// ── Step 1: Create .lproj/InfoPlist.strings files ───────────────────────────

console.log("Creating .lproj/InfoPlist.strings files...");

for (const locale of Object.keys(SAFARI_LOCALES)) {
  const { displayName } = SAFARI_LOCALES[locale];
  const content = [
    `CFBundleDisplayName = "${displayName}";`,
    `CFBundleName = "gyoza";`,
    "",
  ].join("\n");

  for (const target of TARGETS) {
    const dir = join(SAFARI_APP_ROOT, target, `${locale}.lproj`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "InfoPlist.strings"), content);
  }
  console.log(`  \u2713 ${locale}`);
}

// ── Step 2: Patch project.pbxproj ───────────────────────────────────────────

console.log("\nPatching project.pbxproj...");

const pbxprojPath = join(SAFARI_APP_ROOT, "gyoza.xcodeproj", "project.pbxproj");
let pbx = readFileSync(pbxprojPath, "utf-8");

// Helper: generate a 24-char uppercase hex ID (Xcode-compatible)
function newId(): string {
  return randomBytes(12).toString("hex").toUpperCase().slice(0, 24);
}

// All locale codes for knownRegions (Apple uses specific codes)
const localeKeys = Object.keys(SAFARI_LOCALES);

// 2a. Update knownRegions to include all locales
const knownRegionsMatch = pbx.match(/knownRegions = \(\s*([\s\S]*?)\s*\);/);
if (knownRegionsMatch) {
  const existingRegions = new Set(
    knownRegionsMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/"/g, ""))
      .filter(Boolean),
  );
  for (const locale of localeKeys) {
    existingRegions.add(locale);
  }
  const regionsList = Array.from(existingRegions)
    .map((r) => `\t\t\t\t${r}`)
    .join(",\n");
  pbx = pbx.replace(
    /knownRegions = \(\s*[\s\S]*?\s*\);/,
    `knownRegions = (\n${regionsList},\n\t\t\t);`,
  );
  console.log(
    `  \u2713 knownRegions updated (${existingRegions.size} regions)`,
  );
}

// 2b. Create InfoPlist.strings PBXVariantGroup for each app target
// We need: PBXFileReference per locale, PBXVariantGroup, PBXBuildFile,
// and entries in the target's Resources build phase + group children.

// Find iOS and macOS app Resources build phase IDs
const iosAppTarget = pbx.match(
  /\/\* gyoza \(iOS\) \*\/ = \{[\s\S]*?buildPhases = \(\s*([\s\S]*?)\s*\)/,
);
const macosAppTarget = pbx.match(
  /\/\* gyoza \(macOS\) \*\/ = \{[\s\S]*?buildPhases = \(\s*([\s\S]*?)\s*\)/,
);

// Find Resources build phase IDs for iOS and macOS app targets
function findResourcesBuildPhaseId(
  targetMatch: RegExpMatchArray | null,
): string | null {
  if (!targetMatch) return null;
  const phases = targetMatch[1];
  const resourcesMatch = phases.match(/([A-F0-9]{24}) \/\* Resources \*\//);
  return resourcesMatch ? resourcesMatch[1] : null;
}

const iosResourcesPhaseId = findResourcesBuildPhaseId(iosAppTarget);
const macosResourcesPhaseId = findResourcesBuildPhaseId(macosAppTarget);

// Find iOS (App) and macOS (App) group IDs to add InfoPlist.strings as child
function findGroupId(groupName: string): string | null {
  const re = new RegExp(
    `([A-F0-9]{24}) \\/\\* ${groupName.replace(/[()]/g, "\\$&")} \\*\\/ = \\{`,
  );
  const m = pbx.match(re);
  return m ? m[1] : null;
}

const iosAppGroupId = findGroupId("iOS (App)");
const macosAppGroupId = findGroupId("macOS (App)");

// Build new pbxproj entries
const newFileRefs: string[] = [];
const newBuildFiles: string[] = [];
const newVariantGroups: string[] = [];

interface TargetInfo {
  name: string;
  resourcesPhaseId: string | null;
  groupId: string | null;
  lprojRelPath: string;
}

const targets: TargetInfo[] = [
  {
    name: "iOS",
    resourcesPhaseId: iosResourcesPhaseId,
    groupId: iosAppGroupId,
    lprojRelPath: "",
  },
  {
    name: "macOS",
    resourcesPhaseId: macosResourcesPhaseId,
    groupId: macosAppGroupId,
    lprojRelPath: "",
  },
];

for (const target of targets) {
  if (!target.resourcesPhaseId || !target.groupId) {
    console.log(
      `  \u26a0 Skipping ${target.name} (target not found in pbxproj)`,
    );
    continue;
  }

  // Create variant group for InfoPlist.strings
  const variantGroupId = newId();
  const childRefs: string[] = [];

  for (const locale of localeKeys) {
    const fileRefId = newId();
    newFileRefs.push(
      `\t\t${fileRefId} /* ${locale} */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ${locale}; path = ${locale}.lproj/InfoPlist.strings; sourceTree = "<group>"; };`,
    );
    childRefs.push(`\t\t\t\t${fileRefId} /* ${locale} */`);
  }

  newVariantGroups.push(
    [
      `\t\t${variantGroupId} /* InfoPlist.strings */ = {`,
      `\t\t\tisa = PBXVariantGroup;`,
      `\t\t\tchildren = (`,
      childRefs.join(",\n") + ",",
      `\t\t\t);`,
      `\t\t\tname = InfoPlist.strings;`,
      `\t\t\tsourceTree = "<group>";`,
      `\t\t};`,
    ].join("\n"),
  );

  // Create build file referencing the variant group
  const buildFileId = newId();
  newBuildFiles.push(
    `\t\t${buildFileId} /* InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = ${variantGroupId} /* InfoPlist.strings */; };`,
  );

  // Add build file to Resources build phase
  pbx = pbx.replace(
    new RegExp(
      `(${target.resourcesPhaseId} \\/\\* Resources \\*\\/ = \\{[\\s\\S]*?files = \\()`,
    ),
    `$1\n\t\t\t\t${buildFileId} /* InfoPlist.strings in Resources */,`,
  );

  // Add variant group to target's group children
  pbx = pbx.replace(
    new RegExp(
      `(${target.groupId} \\/\\* [^*]* \\*\\/ = \\{[\\s\\S]*?children = \\()`,
    ),
    `$1\n\t\t\t\t${variantGroupId} /* InfoPlist.strings */,`,
  );

  console.log(`  \u2713 ${target.name} app target patched`);
}

// Inject new PBXFileReference entries
pbx = pbx.replace(
  "/* End PBXFileReference section */",
  newFileRefs.join("\n") + "\n/* End PBXFileReference section */",
);

// Inject new PBXBuildFile entries
pbx = pbx.replace(
  "/* End PBXBuildFile section */",
  newBuildFiles.join("\n") + "\n/* End PBXBuildFile section */",
);

// Inject new PBXVariantGroup entries
pbx = pbx.replace(
  "/* End PBXVariantGroup section */",
  newVariantGroups.join("\n") + "\n/* End PBXVariantGroup section */",
);

writeFileSync(pbxprojPath, pbx);
console.log(`  \u2713 project.pbxproj written`);

console.log(`\nSafari localization complete (${localeKeys.length} locales)`);
