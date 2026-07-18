import type { Metadata } from "next";
import { StyleguideBody } from "./StyleguideBody";

export const metadata: Metadata = {
  title: "Operator OS v2 · Arcade Paper — Styleguide",
  robots: { index: false, follow: false },
};

export default function StyleguidePage() {
  return <StyleguideBody />;
}
