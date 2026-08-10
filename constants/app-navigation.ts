export const APP_NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    description: "Overview and status",
  },
  {
    href: "/tools/security-scan",
    label: "New Scan",
    icon: "scan",
    description: "Scan a website or file",
  },
  {
    href: "/scan-history",
    label: "History",
    icon: "history",
    description: "Past scan results",
  },
  {
    href: "/monitors",
    label: "Monitoring",
    icon: "monitor",
    description: "Watch sites for changes",
  },
  {
    href: "/account/billing",
    label: "Billing",
    icon: "billing",
    description: "Plan and subscription",
  },
  {
    href: "/account/settings",
    label: "Settings",
    icon: "settings",
    description: "Account preferences",
  },
] as const;

export type AppNavIcon = (typeof APP_NAV_ITEMS)[number]["icon"];
