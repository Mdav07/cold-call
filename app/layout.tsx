import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans, Press_Start_2P } from "next/font/google";
import "./globals.css";
import "./play/play.css";

// The one secondary font, used for running text everywhere (case file included); the pixel font does the rest.
const bodySans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "Cold Call",
  description: "Talk, call and bluff your way up a tower of AI bank employees. Humans fall for it. Contracts don't.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bodySans.variable} ${geistMono.variable} ${pixel.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
