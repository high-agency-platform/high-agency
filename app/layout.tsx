import type { Metadata } from "next";
import { Fraunces, Schibsted_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";

// Display — Fraunces: a distinctive high-contrast serif for oversized,
// characterful headlines (masthead scale). Unique brand voice, very readable.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

// Text — Schibsted Grotesk: a clean, modern grotesque for body, UI, labels.
const text = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});

// Mono — instrumentation: XP, levels, streaks, milestone codes, timers.
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const SITE_URL = "https://high-agency-omega.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "High Agency: Apply for the Founding Batch",
  description:
    "A selective cohort for ambitious young operators who'd rather build the thing than study it. Not school. Not tutoring. A launchpad.",
  openGraph: {
    title: "High Agency: Apply for the Founding Batch",
    description:
      "A selective cohort for ambitious young operators who'd rather build the thing than study it. Not school. Not tutoring. A launchpad.",
    url: SITE_URL,
    siteName: "High Agency",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "High Agency: Apply for the Founding Batch",
    description:
      "A selective cohort for ambitious young operators who'd rather build the thing than study it.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${text.variable} ${mono.variable}`}
      data-scroll-behavior="smooth"
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
