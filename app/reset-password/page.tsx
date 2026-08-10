import { redirect } from "next/navigation";
import { RESET_PASSWORD_PATH } from "@/lib/auth/reset-password-url";

/** Legacy route — password reset now lives at /auth/reset-password. */
export default function LegacyResetPasswordRedirect() {
  redirect(RESET_PASSWORD_PATH);
}
