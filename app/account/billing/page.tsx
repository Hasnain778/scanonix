import { AccountBillingSection } from "@/components/account/AccountBillingSection";
import { AccountShell } from "@/components/account/AccountShell";
import { getAccountPageContext } from "@/lib/account/page-context";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Billing",
  description: "View your Scanonix plan, usage, and manage your subscription.",
  path: "/account/billing",
  noIndex: true,
});

export default async function AccountBillingPage() {
  await getAccountPageContext();

  return (
    <AccountShell
      title="Billing"
      description="Review your plan, usage, renewal dates, and manage your Stripe subscription."
    >
      <AccountBillingSection />
    </AccountShell>
  );
}
