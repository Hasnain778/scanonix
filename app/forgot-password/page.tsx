import { Suspense } from "react";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoadingState } from "@/components/common/LoadingState";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Forgot Password",
  description: "Reset your Scanonix account password.",
  path: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot password"
      description="Enter your email and we will send you a link to reset your password."
      footer={
        <>
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-semibold text-scanonix-orange hover:text-scanonix-orange-light"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<LoadingState title="Loading…" className="py-8" />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
