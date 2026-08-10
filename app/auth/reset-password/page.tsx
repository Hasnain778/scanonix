import { Suspense } from "react";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoadingState } from "@/components/common/LoadingState";
import { RESET_PASSWORD_PATH } from "@/lib/auth/reset-password-url";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Reset Password",
  description: "Set a new password for your Scanonix account.",
  path: RESET_PASSWORD_PATH,
  noIndex: true,
});

export default function AuthResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      description="Choose a strong password with at least 8 characters."
      footer={
        <>
          Return to{" "}
          <Link
            href="/login"
            className="font-semibold text-scanonix-orange hover:text-scanonix-orange-light"
          >
            sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<LoadingState title="Loading…" className="py-8" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
