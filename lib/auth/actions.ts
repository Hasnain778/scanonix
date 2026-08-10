"use server";

import { revalidatePath } from "next/cache";
import {
  validateFullName,
  validatePassword,
} from "@/lib/validators/auth";
import {
  sanitizeTextInput,
  validateCountry,
  validateOptionalText,
  validateTimeZone,
} from "@/lib/validators/account";
import { buildAuthCallbackUrl } from "@/lib/auth/callback-url";
import { buildResetPasswordRedirectUrl } from "@/lib/auth/reset-password-url";
import {
  removeAvatar,
  updateProfileFields,
  uploadAvatar,
} from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

/** Server-side sign-out for non-interactive flows. UI should use clientSignOut(). */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

export async function updateDisplayNameAction(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "");
  const nameError = validateFullName(fullName);
  if (nameError) {
    return { error: nameError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await updateProfileFields(user.id, {
    full_name: fullName.trim(),
  });

  if (error) {
    return { error };
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  revalidatePath("/dashboard");
  return { success: "Display name updated." };
}

export async function updateProfileDetailsAction(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "");
  const companyName = String(formData.get("companyName") ?? "");
  const jobTitle = String(formData.get("jobTitle") ?? "");
  const country = String(formData.get("country") ?? "");
  const timeZone = String(formData.get("timeZone") ?? "");

  const nameError = validateFullName(fullName);
  if (nameError) {
    return { error: nameError };
  }

  const companyError = validateOptionalText(companyName, "Company name");
  if (companyError) {
    return { error: companyError };
  }

  const jobError = validateOptionalText(jobTitle, "Job title");
  if (jobError) {
    return { error: jobError };
  }

  const countryError = validateCountry(country);
  if (countryError) {
    return { error: countryError };
  }

  const timeZoneError = validateTimeZone(timeZone);
  if (timeZoneError) {
    return { error: timeZoneError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await updateProfileFields(user.id, {
    full_name: sanitizeTextInput(fullName, 120),
    company_name: sanitizeTextInput(companyName, 120) || null,
    job_title: sanitizeTextInput(jobTitle, 120) || null,
    country: sanitizeTextInput(country, 80) || null,
    time_zone: sanitizeTextInput(timeZone, 64) || null,
  });

  if (error) {
    return { error };
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  revalidatePath("/dashboard");
  return { success: "Profile updated." };
}

export async function uploadAvatarAction(formData: FormData) {
  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) {
    return { error: "Please choose an image file." };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Avatar must be an image file." };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { error: "Avatar must be 2 MB or smaller." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await uploadAvatar(user.id, file);
  if (error) {
    return { error };
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  revalidatePath("/dashboard");
  return { success: "Profile photo updated." };
}

export async function removeAvatarAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await removeAvatar(user.id);
  if (error) {
    return { error };
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  revalidatePath("/dashboard");
  return { success: "Profile photo removed." };
}

export async function updatePasswordAction(formData: FormData) {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!currentPassword) {
    return { error: "Enter your current password." };
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }

  if (password !== confirmation) {
    return { error: "New passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "You must be signed in." };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/account/security");
  return { success: "Password updated successfully." };
}

export async function sendPasswordResetEmailAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "No email address found for this account." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: buildResetPasswordRedirectUrl(),
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Password reset email sent." };
}

export async function resendVerificationAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "No email address found for this account." };
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: {
      emailRedirectTo: buildAuthCallbackUrl("/dashboard"),
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Verification email sent." };
}
