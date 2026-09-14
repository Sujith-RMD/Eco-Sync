import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
    "Live cybersecurity investigation protocol. Sixty-one teams enter a compromised facility. Fifteen advance. Three expose the insider.",
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
          Vercel observability, rendered only on Vercel's own runtime. Off-platform
          a rehearsal served from the laptop would make every phone fetch scripts
          whose events cannot be attributed to a project, for no measurement in
          return. One gate covers both because they share that dependency:

            Analytics     — page views and visitors.
            SpeedInsights — real-user Core Web Vitals (LCP / CLS / INP) from the
                            actual handsets in the venue, which is the number
                            worth having before 61 devices arrive at once.

          Both keep their default reporting modes, so a real deployment measures
          production traffic. Enable each in the project's Vercel dashboard; the
          packages only send, they do not switch collection on.
        */}
        {process.env.VERCEL === "1" ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
