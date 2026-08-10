import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";
import { AccountShell } from "@/components/account/AccountShell";
import { getAccountPageContext } from "@/lib/account/page-context";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Security",
  description: "Manage your Scanonix password, sessions, and sign-in security.",
  path: "/account/security",
  noIndex: true,
});

export default async function AccountSecurityPage() {
  const { authDetails } = await getAccountPageContext();

  return (
    <AccountShell
      title="Security"
      description="Change your password, request a reset email, and manage active sessions."
    >
      <AccountSecurityPanel authDetails={authDetails} />
    </AccountShell>
  );
}
