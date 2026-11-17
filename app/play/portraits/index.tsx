import type React from "react";
import { Penny } from "./Penny";
import { Dee } from "./Dee";
import { Annie } from "./Annie";
import { Bill } from "./Bill";
import { Cassius } from "./Cassius";
import { Max } from "./Max";
import { Barry } from "./Barry";
import { Krystal } from "./Krystal";

export type { PortraitMood, PortraitProps } from "./shared";

export const PORTRAITS: Record<
  string,
  (props: { mood: "neutral" | "suspicious" | "convinced" }) => React.JSX.Element
> = {
  penny: Penny,
  dee: Dee,
  annie: Annie,
  bill: Bill,
  cassius: Cassius,
  max: Max,
  barry: Barry,
  krystal: Krystal,
};
