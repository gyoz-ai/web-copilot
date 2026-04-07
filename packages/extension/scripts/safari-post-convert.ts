// Post-convert: inject LSApplicationCategoryType into Safari app Info.plist
// files after safari-web-extension-converter regenerates them with --force.
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SAFARI_APP_ROOT = join(import.meta.dirname!, "..", "safari-app", "gyoza");
const CATEGORY = "public.app-category.productivity";

const PLISTS = [
  join(SAFARI_APP_ROOT, "macOS (App)", "Info.plist"),
  join(SAFARI_APP_ROOT, "iOS (App)", "Info.plist"),
];

for (const path of PLISTS) {
  let content = readFileSync(path, "utf-8");

  if (content.includes("LSApplicationCategoryType")) {
    console.log(`  ✓ ${path.split("gyoza/")[1]} — already has category`);
    continue;
  }

  // Insert right after <dict>
  content = content.replace(
    "<dict>",
    `<dict>\n\t<key>LSApplicationCategoryType</key>\n\t<string>${CATEGORY}</string>`,
  );

  writeFileSync(path, content);
  console.log(`  ✓ ${path.split("gyoza/")[1]} — injected ${CATEGORY}`);
}
