import type { Viewport } from "next";

// The root layout loads the pixel font and the game styles.
// On phones the on-screen keyboard resizes the page (Android Chrome), so the dialogue box and its
// text field stay above it; iOS is handled in the box with the visual viewport.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function FloorLayout({ children }: LayoutProps<"/floor/[floor]">) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
