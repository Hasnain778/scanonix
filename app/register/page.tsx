import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterAuthGuard } from "@/components/auth/RegisterAuthGuard";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoadingState } from "@/components/common/LoadingState";
import { getAuthUser } from "@/lib/auth/session";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Create Account",
  description: "Create your Scanonix account.",
  path: "/register",
  noIndex: true,
});

export default async function RegisterPage() {
  const authUser = await getAuthUser();
  if (authUser) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Create your account"
      description="Join Scanonix to access your dashboard, save preferences, and unlock Pro features."
      footer={
        <>
          Already have an account?{" "}
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
        <RegisterAuthGuard>
          <RegisterForm />
        </RegisterAuthGuard>
      </Suspense>
    </AuthShell>
  );
}
