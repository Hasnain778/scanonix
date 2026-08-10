import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoadingState } from "@/components/common/LoadingState";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Sign In",
  description: "Sign in to your Scanonix account.",
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to access your dashboard, account settings, and saved workspace."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-scanonix-orange hover:text-scanonix-orange-light"
          >
            Create account
          </Link>
        </>
      }
    >
      <Suspense fallback={<LoadingState title="Loading…" className="py-8" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
