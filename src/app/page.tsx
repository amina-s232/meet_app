import { redirect } from "next/navigation";

// Signed-in users land on the dashboard; the dashboard sends everyone else to /login.
export default function Home() {
  redirect("/dashboard");
}