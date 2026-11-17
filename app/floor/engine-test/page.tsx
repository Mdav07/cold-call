"use client";
// Engine test bench (A). Not linked from the game; removed once /floor/[floor] works.
import { useState } from "react";
import { FloorScene } from "../engine/FloorScene";
import placeholder from "../maps/floor-1.placeholder.json";
import type { FloorMap, SceneEvent } from "../types";

const map = placeholder as unknown as FloorMap;

export default function EngineTest() {
  const [log, setLog] = useState<string[]>([]);
  const [talking, setTalking] = useState<string | null>(null);
  const onEvent = (e: SceneEvent) => {
    setLog((l) => [JSON.stringify(e), ...l].slice(0, 5));
    if (e.type === "interact-npc") setTalking(e.id);
  };
  return (
    <main className="cc-floor-1 flex h-dvh flex-col">
      <div className="relative min-h-0 flex-1">
        <FloorScene
          map={map}
          playerSprite="/sprites/placeholder-player.png"
          paused={!!talking}
          onEvent={onEvent}
          emotes={talking ? { [talking]: "talking" } : {}}
        />
        {talking && (
          <div className="pixel-frame absolute inset-x-4 bottom-4 bg-black p-4 font-pixel text-xs text-white">
            Talking to {talking}.{" "}
            <button className="pixel-button" onClick={() => setTalking(null)} autoFocus>
              Leave
            </button>
          </div>
        )}
      </div>
      <pre data-testid="log" className="max-h-24 overflow-auto p-2 text-xs">{log.join("\n")}</pre>
    </main>
  );
}
