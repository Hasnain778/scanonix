import { redirect } from "next/navigation";

export default function ScanResultsIndexPage() {
  if (process.env.NODE_ENV === "production") {
    redirect("/scan-history");
  }
  redirect("/scan-results/demo");
}
