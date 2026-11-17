// Each employee's dialogue box takes their look: colours from their portrait for the border,
// name tag, accent (choice cursor, buttons) and a dark tinted panel.
// Checked for WCAG AA: body ink (#f2efe6), muted text, warning, success and the lighter red below
// all reach 4.5:1 on each panel; the tag and accent reach 4.5:1 under dark ink (#15141a);
// the border reaches 3:1 against the panel.

import type { CSSProperties } from "react";

export interface BoxTheme {
  border: string;
  tag: string;
  accent: string;
  panel: string;
}

/** Signs, memos and anyone without a palette: the game's default box. */
export const DEFAULT_THEME: BoxTheme = { border: "#15141a", tag: "#f4c95d", accent: "#f4c95d", panel: "#1f2a44" };

const THEMES: Record<string, BoxTheme> = {
  penny: { border: "#c45c2a", tag: "#d4a0b8", accent: "#f0c040", panel: "#3a2230" },
  dee: { border: "#5c9a82", tag: "#8fc4ad", accent: "#f4c95d", panel: "#1d2f29" },
  annie: { border: "#c45c5c", tag: "#f4f1ea", accent: "#f0c4a0", panel: "#3a2424" },
  bill: { border: "#4a72a8", tag: "#8ab4d4", accent: "#c8dcec", panel: "#1a2638" },
  cassius: { border: "#a85a5a", tag: "#c49a6c", accent: "#d8b48a", panel: "#1f1712" },
  max: { border: "#a08060", tag: "#fff4b0", accent: "#f4c95d", panel: "#2a2418" },
  barry: { border: "#8a9a78", tag: "#c8d4b8", accent: "#c8d4b8", panel: "#22281e" },
  krystal: { border: "#7ec8e8", tag: "#b8e8f8", accent: "#7ec8e8", panel: "#1a2a33" },
};

export const themeFor = (id: string): BoxTheme => THEMES[id] ?? DEFAULT_THEME;

/** CSS variables for the box. The red is lightened inside the box so small red text stays AA. */
export function themeVars(t: BoxTheme): CSSProperties {
  return {
    "--cc-dialog": t.panel,
    "--cc-accent": t.accent,
    "--cc-tag": t.tag,
    "--cc-border": t.border,
    "--cc-danger": "#f28b82",
  } as CSSProperties;
}
