import type { Metadata } from "next";
import { Gabarito, Geist_Mono } from "next/font/google";
import "./globals.css";

// One loud family — Gabarito (400–900): friendly-geometric at body weights,
// game-title confident at 800/900. The whole UI speaks it.
const text = Gabarito({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

// Mono — instrumentation: XP, streaks, counts, dates, codes.
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
      className={`${text.variable} ${mono.variable}`}
      data-scroll-behavior="smooth"
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
