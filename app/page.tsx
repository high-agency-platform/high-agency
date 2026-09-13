import Waitlist from "./Waitlist";
import { connection } from "next/server";
import { applicationsClosed } from "./lib/applicationWindow";

export default async function Home() {
  // Date-sensitive HTML must reflect the request time, not the last build.
  await connection();
  return <Waitlist initiallyClosed={applicationsClosed()} />;
}
