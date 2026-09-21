import AccessForm from "../../components/AccessForm";

export const metadata = { title: "Join Season 1 · High Agency", referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  return <AccessForm invite={typeof invite === "string" ? invite : "invalid"} />;
}
