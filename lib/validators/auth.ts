const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return "Email is required.";
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return "Password is required.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export function validateFullName(fullName: string): string | null {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return "Full name is required.";
  }
  if (trimmed.length < 2) {
    return "Full name must be at least 2 characters.";
  }
  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (!confirmation) {
    return "Please confirm your password.";
  }
  if (password !== confirmation) {
    return "Passwords do not match.";
  }
  return null;
}
