// Renders every pixel portrait (app/play/portraits) to SVG markup, so tools/art/portrait_sprites.py
// can rebuild the walking sprites from the same art as the dialogue box.
//   npx tsx --tsconfig tsconfig.json tools/art/export_portraits.tsx <out.json>
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PORTRAITS } from "../../app/play/portraits";

const out: Record<string, string> = {};
for (const [id, Portrait] of Object.entries(PORTRAITS)) {
  out[id] = renderToStaticMarkup(Portrait({ mood: "neutral" }));
}
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(`exported ${Object.keys(out).length} portraits`);
