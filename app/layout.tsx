import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { NotifyRoot } from "@/components/notify";
import { AppShell } from "@/components/shell/AppShell";
import { ThemeScript } from "@/components/shell/ThemeScript";
import "react-day-picker/style.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
// light is oklch(1 0 0) = #ffffff, dark is oklch(0.145 0 0) = #0a0a0a. Mobile
// browser chrome follows the user's system color scheme until the in-app theme
// toggle lands (chunk 2 of #79).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
