import { redirect } from "next/navigation";

export default async function AccountIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  if (params.tab === "billing") {
    redirect("/account/billing");
  }
  redirect("/account/profile");
}
