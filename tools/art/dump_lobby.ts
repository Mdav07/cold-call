// Dumps the code-built lobby map (app/tower/lobbyMap.ts) to JSON for tools/art/audit_maps.py.
//   npx tsx --tsconfig tsconfig.json tools/art/dump_lobby.ts <out.json>
import { writeFileSync } from "node:fs";
import { buildLobby } from "../../app/tower/lobbyMap";

const floors = [0, 1, 2, 3].map((floor) => ({
  floor, name: `Floor ${floor}`, description: "", vault: "", rule: null, balanceUsd: 1,
  employees: [], cleared: true, unlocked: true, bestMs: null, board: [],
}));
// Everything unlocked, so every elevator, exit and sign is present.
writeFileSync(process.argv[2], JSON.stringify(buildLobby(floors as never)));
console.log("lobby dumped");
