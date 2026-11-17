import { Press_Start_2P } from "next/font/google";
import "@/app/play/play.css";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });

export default function FloorLayout({ children }: LayoutProps<"/floor/[floor]">) {
  return <div className={`${pixel.variable} flex min-h-full flex-1 flex-col`}>{children}</div>;
}
