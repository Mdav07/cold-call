import { Press_Start_2P } from "next/font/google";
import "./play.css";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });

export default function PlayLayout({ children }: LayoutProps<"/play">) {
  return <div className={`${pixel.variable} cc-floor-1 flex min-h-full flex-1 flex-col`}>{children}</div>;
}
