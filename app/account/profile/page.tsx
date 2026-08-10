import { AccountProfilePanel } from "@/components/account/AccountProfilePanel";
import { AccountShell } from "@/components/account/AccountShell";
import { getAccountPageContext } from "@/lib/account/page-context";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Profile",
  description: "Manage your Scanonix profile, avatar, and account details.",
  path: "/account/profile",
  noIndex: true,
});

export default async function AccountProfilePage() {
  const { user, authDetails } = await getAccountPageContext();

  return (
    <AccountShell
      title="Profile"
      description="Update your personal information, avatar, and view read-only account details."
    >
      <AccountProfilePanel user={user} authDetails={authDetails} />
    </AccountShell>
  );
}
