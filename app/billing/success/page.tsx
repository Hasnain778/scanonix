import { Suspense } from "react";
import Link from "next/link";
import { BillingSuccessClient } from "@/components/billing/BillingSuccessClient";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoadingState } from "@/components/common/LoadingState";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Billing Success",
  description: "Your Scanonix subscription is being confirmed.",
  path: "/billing/success",
  noIndex: true,
});

export default function BillingSuccessPage() {
  return (
    <AuthShell
      title="Payment received"
      description="We are confirming your subscription. Access updates after Stripe webhooks sync your profile."
      footer={
        <>
          Need help?{" "}
          <Link
            href="/contact"
            className="font-semibold text-scanonix-orange hover:text-scanonix-orange-light"
          >
            Contact support
          </Link>
        </>
      }
    >
      <Suspense fallback={<LoadingState title="Confirming subscription…" className="py-8" />}>
        <BillingSuccessClient />
      </Suspense>
    </AuthShell>
  );
}
