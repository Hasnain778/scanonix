import { AccountNotificationsPanel } from "@/components/account/AccountNotificationsPanel";
import { AccountPrivacyPanel } from "@/components/account/AccountPrivacyPanel";
import { AccountShell } from "@/components/account/AccountShell";
import { getAccountPageContext } from "@/lib/account/page-context";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Settings",
  description: "Manage Scanonix notification preferences, data exports, and privacy controls.",
  path: "/account/settings",
  noIndex: true,
});

export default async function AccountSettingsPage() {
  await getAccountPageContext();

  return (
    <AccountShell
      title="Settings"
      description="Control notifications, export your data, and manage privacy-related actions."
    >
      <AccountNotificationsPanel />
      <AccountPrivacyPanel />
    </AccountShell>
  );
}
