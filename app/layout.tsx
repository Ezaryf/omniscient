import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Omniscient - GM Consequence Engine",
  description:
    "A GM-first campaign simulator for branching timelines, event causality, campaign maps, and session prep consequences.",
  keywords: [
    "campaign simulator",
    "ttrpg gm",
    "branching timelines",
    "causality",
    "worldbuilding",
    "session prep",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
