import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
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
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
