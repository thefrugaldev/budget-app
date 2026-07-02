import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Nunito } from "next/font/google";

import { NotifyRoot } from "@/components/notify";
import { AppShell } from "@/components/shell/AppShell";
import { ThemeScript } from "@/components/shell/ThemeScript";
import "react-day-picker/style.css";
import "./globals.css";

// Identity type roles (#80 chunk 2). Bricolage Grotesque is the display face
// (hero figures + headings, via --font-heading); Nunito is the body face
// (--font-sans). Geist Mono is retained for the rare monospace need.
const displayFont = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Budget",
    template: "%s — Budget",
  },
  description: "Track monthly spend by category",
};

// Theme colors match the app background tokens (--background) in globals.css:
// the warm Harvest palette (#80 chunk 2) — light #f1e8d7, dark #141109 — so the
// mobile browser chrome tracks the app background in both schemes.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1e8d7" },
    { media: "(prefers-color-scheme: dark)", color: "#141109" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The before-paint ThemeScript toggles `.dark` on <html> before React
      // hydrates, so the class differs from the server-rendered markup by design.
      suppressHydrationWarning
      className={`${displayFont.variable} ${bodyFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeScript />
        <NotifyRoot>
          <AppShell>{children}</AppShell>
        </NotifyRoot>
      </body>
    </html>
  );
}
