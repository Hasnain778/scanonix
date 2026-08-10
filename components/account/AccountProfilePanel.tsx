"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthMessage } from "@/components/auth/AuthShell";
import { ActionButton } from "@/components/ui/ActionButton";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  AccountCard,
  AccountFormField,
  AccountSelect,
  AccountTextInput,
} from "@/components/account/AccountFormField";
import { COUNTRY_OPTIONS } from "@/lib/account/countries";
import { TIMEZONE_OPTIONS } from "@/lib/account/timezones";
import {
  removeAvatarAction,
  resendVerificationAction,
  updateProfileDetailsAction,
  uploadAvatarAction,
} from "@/lib/auth/actions";
import type { AccountAuthDetails, AuthUser } from "@/types/auth";
import { useToast } from "@/hooks/useToast";

interface AccountProfilePanelProps {
  user: AuthUser;
  authDetails: AccountAuthDetails;
}

export function AccountProfilePanel({ user, authDetails }: AccountProfilePanelProps) {
  const router = useRouter();
  const { refresh, user: authUser } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user.profile?.full_name ?? "");
  const [companyName, setCompanyName] = useState(user.profile?.company_name ?? "");
  const [jobTitle, setJobTitle] = useState(user.profile?.job_title ?? "");
  const [country, setCountry] = useState(user.profile?.country ?? "");
  const [timeZone, setTimeZone] = useState(user.profile?.time_zone ?? "");

  const [profileMessage, setProfileMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const avatarUrl = user.profile?.avatar_url;

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileLoading(true);
    setProfileMessage(null);

    const formData = new FormData();
    formData.set("fullName", fullName);
    formData.set("companyName", companyName);
    formData.set("jobTitle", jobTitle);
    formData.set("country", country);
    formData.set("timeZone", timeZone);

    const result = await updateProfileDetailsAction(formData);

    if (result.error) {
      setProfileMessage({ type: "error", text: result.error });
      showToast(result.error, "error");
    } else if (result.success) {
      setProfileMessage({ type: "success", text: result.success });
      showToast(result.success, "success");
      await refresh();
      router.refresh();
    }

    setProfileLoading(false);
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarLoading(true);
    setAvatarMessage(null);

    const formData = new FormData();
    formData.set("avatar", file);
    const result = await uploadAvatarAction(formData);

    if (result.error) {
      setAvatarMessage({ type: "error", text: result.error });
      showToast(result.error, "error");
    } else if (result.success) {
      setAvatarMessage({ type: "success", text: result.success });
      showToast(result.success, "success");
      await refresh();
      router.refresh();
    }

    setAvatarLoading(false);
    event.target.value = "";
  }

  async function handleRemoveAvatar() {
    setAvatarLoading(true);
    setAvatarMessage(null);

    const result = await removeAvatarAction();
    if (result.error) {
      setAvatarMessage({ type: "error", text: result.error });
      showToast(result.error, "error");
    } else if (result.success) {
      setAvatarMessage({ type: "success", text: result.success });
      showToast(result.success, "success");
      await refresh();
      router.refresh();
    }

    setAvatarLoading(false);
  }

  async function handleResendVerification() {
    setVerifyLoading(true);
    setVerifyMessage(null);

    const result = await resendVerificationAction();
    if (result.error) {
      setVerifyMessage({ type: "error", text: result.error });
      showToast(result.error, "error");
    } else if (result.success) {
      setVerifyMessage({ type: "success", text: result.success });
      showToast(result.success, "success");
    }

    setVerifyLoading(false);
  }

  function formatDate(value: string | null) {
    if (!value) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  return (
    <div className="space-y-6">
      {!authDetails.emailVerified && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h2 className="text-base font-semibold text-amber-200">Email not verified</h2>
          <p className="mt-2 text-sm text-scanonix-muted">
            Verify your email address to secure your account.
          </p>
          {verifyMessage && (
            <div className="mt-3">
              <AuthMessage type={verifyMessage.type} message={verifyMessage.text} />
            </div>
          )}
          <ActionButton
            className="mt-4"
            variant="outline"
            loading={verifyLoading}
            disabled={verifyLoading}
            onClick={handleResendVerification}
          >
            Resend verification email
          </ActionButton>
        </div>
      )}

      <AccountCard title="Profile photo" description="Upload a photo or use your initials fallback.">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
            {authUser ? (
              <UserAvatar
                user={authUser}
                profile={user.profile}
                size={80}
                className="rounded-2xl"
                textClassName="text-xl"
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              variant="outline"
              loading={avatarLoading}
              disabled={avatarLoading}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload photo
            </ActionButton>
            {avatarUrl ? (
              <ActionButton
                variant="ghost"
                loading={avatarLoading}
                disabled={avatarLoading}
                onClick={handleRemoveAvatar}
              >
                Remove
              </ActionButton>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleAvatarChange}
          />
        </div>
        {avatarMessage ? (
          <div className="mt-4">
            <AuthMessage type={avatarMessage.type} message={avatarMessage.text} />
          </div>
        ) : null}
      </AccountCard>

      <AccountCard
        title="Profile information"
        description="Update how you appear across Scanonix."
      >
        <form onSubmit={handleProfileSubmit} className="space-y-5">
          <AccountFormField id="fullName" label="Full name">
            <AccountTextInput
              id="fullName"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
            />
          </AccountFormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <AccountFormField id="companyName" label="Company name">
              <AccountTextInput
                id="companyName"
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                autoComplete="organization"
              />
            </AccountFormField>

            <AccountFormField id="jobTitle" label="Job title">
              <AccountTextInput
                id="jobTitle"
                type="text"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                autoComplete="organization-title"
              />
            </AccountFormField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <AccountFormField id="country" label="Country">
              <AccountSelect
                id="country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.value || "empty"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AccountSelect>
            </AccountFormField>

            <AccountFormField id="timeZone" label="Time zone">
              <AccountSelect
                id="timeZone"
                value={timeZone}
                onChange={(event) => setTimeZone(event.target.value)}
              >
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value || "empty"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AccountSelect>
            </AccountFormField>
          </div>

          {profileMessage ? (
            <AuthMessage type={profileMessage.type} message={profileMessage.text} />
          ) : null}

          <ActionButton type="submit" loading={profileLoading} disabled={profileLoading}>
            Save profile
          </ActionButton>
        </form>
      </AccountCard>

      <AccountCard title="Account details" description="Read-only account identifiers.">
        <dl className="space-y-4 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <dt className="text-scanonix-muted">Email address</dt>
            <dd className="font-medium text-white">{authDetails.email}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <dt className="text-scanonix-muted">User ID</dt>
            <dd className="break-all font-mono text-xs text-white/90">{authDetails.id}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <dt className="text-scanonix-muted">Account created</dt>
            <dd className="font-medium text-white">{formatDate(authDetails.createdAt)}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <dt className="text-scanonix-muted">Authentication provider</dt>
            <dd className="font-medium text-white">{authDetails.providers.join(", ")}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <dt className="text-scanonix-muted">Email verification</dt>
            <dd className="font-medium text-white">
              {authDetails.emailVerified ? "Verified" : "Not verified"}
            </dd>
          </div>
        </dl>
      </AccountCard>
    </div>
  );
}
