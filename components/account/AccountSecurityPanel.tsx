"use client";

import { useState } from "react";
import { AuthMessage } from "@/components/auth/AuthShell";
import { useSignOut } from "@/components/auth/useSignOut";
import { ActionButton } from "@/components/ui/ActionButton";
import { AccountCard, AccountFormField, AccountTextInput } from "@/components/account/AccountFormField";
import {
  sendPasswordResetEmailAction,
  updatePasswordAction,
} from "@/lib/auth/actions";
import type { AccountAuthDetails } from "@/types/auth";
import { useToast } from "@/hooks/useToast";

interface AccountSecurityPanelProps {
  authDetails: AccountAuthDetails;
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AccountSecurityPanel({ authDetails }: AccountSecurityPanelProps) {
  const signOut = useSignOut();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [resetMessage, setResetMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  const isGoogleOnly =
    authDetails.providers.length === 1 &&
    authDetails.providers[0]?.toLowerCase().includes("google") &&
    !authDetails.hasPasswordLogin;

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage(null);

    const formData = new FormData();
    formData.set("currentPassword", currentPassword);
    formData.set("password", password);
    formData.set("confirmation", confirmation);

    const result = await updatePasswordAction(formData);

    if (result.error) {
      setPasswordMessage({ type: "error", text: result.error });
      showToast(result.error, "error");
    } else if (result.success) {
      setPasswordMessage({ type: "success", text: result.success });
      showToast(result.success, "success");
      setCurrentPassword("");
      setPassword("");
      setConfirmation("");
    }

    setPasswordLoading(false);
  }

  async function handlePasswordResetEmail() {
    setResetLoading(true);
    setResetMessage(null);

    const result = await sendPasswordResetEmailAction();
    if (result.error) {
      setResetMessage({ type: "error", text: result.error });
      showToast(result.error, "error");
    } else if (result.success) {
      setResetMessage({ type: "success", text: result.success });
      showToast(result.success, "success");
    }

    setResetLoading(false);
  }

  async function handleSignOut() {
    setSignOutLoading(true);
    try {
      await signOut("/login");
    } catch {
      setSignOutLoading(false);
      showToast("Could not sign out. Please try again.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <AccountCard
        title="Change password"
        description={
          isGoogleOnly
            ? "Your account uses Google sign-in. Password management is handled by Google unless you also add an email and password login."
            : "Choose a strong password with at least 8 characters."
        }
      >
        {isGoogleOnly ? (
          <p className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-scanonix-muted">
            To use a Scanonix password, add an email login from your Google account settings
            or contact support for help linking credentials.
          </p>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <AccountFormField id="currentPassword" label="Current password">
              <AccountTextInput
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </AccountFormField>

            <AccountFormField id="password" label="New password">
              <AccountTextInput
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </AccountFormField>

            <AccountFormField id="confirmation" label="Confirm new password">
              <AccountTextInput
                id="confirmation"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                required
              />
            </AccountFormField>

            {passwordMessage ? (
              <AuthMessage type={passwordMessage.type} message={passwordMessage.text} />
            ) : null}

            <ActionButton type="submit" loading={passwordLoading} disabled={passwordLoading}>
              Update password
            </ActionButton>
          </form>
        )}
      </AccountCard>

      <AccountCard
        title="Password reset email"
        description="Send a secure link to reset your password via email."
      >
        {resetMessage ? (
          <AuthMessage type={resetMessage.type} message={resetMessage.text} />
        ) : null}
        <ActionButton
          className="mt-4"
          variant="outline"
          loading={resetLoading}
          disabled={resetLoading}
          onClick={handlePasswordResetEmail}
        >
          Send reset email
        </ActionButton>
      </AccountCard>

      <AccountCard
        title="Recent sign-in"
        description="Session information from your authentication provider."
      >
        <dl className="space-y-4 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <dt className="text-scanonix-muted">Last sign-in</dt>
            <dd className="font-medium text-foreground">{formatDate(authDetails.lastSignInAt)}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <dt className="text-scanonix-muted">Providers</dt>
            <dd className="font-medium text-foreground">{authDetails.providers.join(", ")}</dd>
          </div>
        </dl>
      </AccountCard>

      <AccountCard
        title="Sign out"
        description="Sign out of Scanonix on all devices connected to this account."
      >
        <ActionButton
          variant="danger"
          loading={signOutLoading}
          disabled={signOutLoading}
          onClick={handleSignOut}
        >
          Sign out everywhere
        </ActionButton>
      </AccountCard>
    </div>
  );
}
