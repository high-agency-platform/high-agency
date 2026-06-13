import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Display — editorial grotesk for oversized headlines (masthead scale).
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Text — neutral neo-grotesk for body, UI, and labels.
const text = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-text",
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
      className={`${display.variable} ${text.variable}`}
      data-scroll-behavior="smooth"
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
