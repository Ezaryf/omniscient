import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omniscient — Multi-Agent Simulation Sandbox",
  description:
    "A graph-first simulation sandbox for exploring multi-agent behavior, branching timelines, and causal explanations.",
  keywords: [
    "simulation",
    "multi-agent",
    "branching timelines",
    "AI",
    "graph",
    "strategy",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        {children}
      </body>
    </html>
  );
}
