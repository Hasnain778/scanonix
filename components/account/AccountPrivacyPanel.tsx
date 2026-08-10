"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthMessage } from "@/components/auth/AuthShell";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  AccountCard,
  AccountFormField,
  AccountTextInput,
} from "@/components/account/AccountFormField";
import { SITE } from "@/config/site";
import { useToast } from "@/hooks/useToast";

export function AccountPrivacyPanel() {
  const { showToast } = useToast();
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteHistoryOpen, setDeleteHistoryOpen] = useState(false);
  const [deleteHistoryLoading, setDeleteHistoryLoading] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );

  async function handleExportData() {
    setExportLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Export failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `scanonix-data-export.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast("Your data export has started.", "success");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not export data.";
      setMessage({ type: "error", text });
      showToast(text, "error");
    } finally {
      setExportLoading(false);
    }
  }

  async function handleDeleteHistory() {
    setDeleteHistoryLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/scan-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = (await response.json()) as { error?: string; deleted?: number };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete scan history.");
      }

      const successText = `Deleted ${data.deleted ?? 0} scan history record(s).`;
      setMessage({ type: "success", text: successText });
      showToast(successText, "success");
      setDeleteHistoryOpen(false);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not delete scan history.";
      setMessage({ type: "error", text });
      showToast(text, "error");
    } finally {
      setDeleteHistoryLoading(false);
    }
  }

  async function handleDeleteAccountRequest() {
    setDeleteAccountLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
          reason: deleteReason,
        }),
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not submit deletion request.");
      }

      const successText =
        data.message ??
        "Your account deletion request has been submitted. Our team will process it shortly.";
      setMessage({ type: "success", text: successText });
      showToast(successText, "success");
      setDeleteAccountOpen(false);
      setDeleteConfirmation("");
      setDeleteReason("");
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Could not submit deletion request.";
      setMessage({ type: "error", text });
      showToast(text, "error");
    } finally {
      setDeleteAccountLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <AccountCard
        title="Download my data"
        description="Export your profile, notification preferences, usage, and scan history metadata as JSON."
      >
        <ActionButton loading={exportLoading} disabled={exportLoading} onClick={handleExportData}>
          Download data export
        </ActionButton>
      </AccountCard>

      <AccountCard
        title="Delete scan history"
        description="Permanently remove all saved scans from your account. This cannot be undone."
      >
        {!deleteHistoryOpen ? (
          <ActionButton variant="danger" onClick={() => setDeleteHistoryOpen(true)}>
            Delete all scan history
          </ActionButton>
        ) : (
          <div className="space-y-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-100">
              This will permanently delete every scan in your history. Reports already exported
              outside Scanonix will not be affected.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                variant="danger"
                loading={deleteHistoryLoading}
                disabled={deleteHistoryLoading}
                onClick={handleDeleteHistory}
              >
                Yes, delete history
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => setDeleteHistoryOpen(false)}>
                Cancel
              </ActionButton>
            </div>
          </div>
        )}
      </AccountCard>

      <AccountCard
        title="Delete account"
        description="Request permanent deletion of your Scanonix account and associated data."
      >
        <p className="text-sm text-scanonix-muted">
          Account deletion is processed manually by our team to protect billing records and ensure
          secure removal across authentication, storage, and scan data. Submit a request below or
          email{" "}
          <a
            href={`mailto:${SITE.supportEmail}?subject=Account%20deletion%20request`}
            className="text-scanonix-orange hover:underline"
          >
            {SITE.supportEmail}
          </a>
          .
        </p>

        {!deleteAccountOpen ? (
          <ActionButton
            className="mt-4"
            variant="danger"
            onClick={() => setDeleteAccountOpen(true)}
          >
            Request account deletion
          </ActionButton>
        ) : (
          <div className="mt-4 space-y-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-100">
              Type <strong>DELETE</strong> to confirm you want to permanently remove your account.
            </p>
            <AccountFormField id="deleteConfirmation" label='Type "DELETE" to confirm'>
              <AccountTextInput
                id="deleteConfirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
              />
            </AccountFormField>
            <AccountFormField id="deleteReason" label="Reason (optional)">
              <AccountTextInput
                id="deleteReason"
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
              />
            </AccountFormField>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                variant="danger"
                loading={deleteAccountLoading}
                disabled={deleteAccountLoading || deleteConfirmation !== "DELETE"}
                onClick={handleDeleteAccountRequest}
              >
                Submit deletion request
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => setDeleteAccountOpen(false)}>
                Cancel
              </ActionButton>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-scanonix-muted">
          You can also review our{" "}
          <Link href="/privacy" className="text-scanonix-orange hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </AccountCard>

      {message ? (
        <AuthMessage type={message.type} message={message.text} />
      ) : null}
    </div>
  );
}
