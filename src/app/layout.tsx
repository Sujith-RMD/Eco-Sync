import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  applicationName: "ECO-SYNC: THE BREACH",
  title: {
    default: "ECO-SYNC: THE BREACH — Cryptic Room",
    template: "%s — ECO-SYNC: THE BREACH",
  },
  description:
    "Live cybersecurity investigation protocol. Sixty units enter a compromised facility. Fifteen advance. Three expose the insider.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#03070c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-abyss-950 font-display text-ink antialiased">
        {children}
        {/*
          Vercel Web Analytics. Rendered only on Vercel's own runtime: off-platform
          a rehearsal served from the laptop would make every phone fetch a script
          whose events have nowhere to be attributed to. `mode` stays at its
          default `auto`, so a real deployment reports as production.
        */}
        {process.env.VERCEL === "1" ? <Analytics /> : null}
      </body>
    </html>
  );
}
