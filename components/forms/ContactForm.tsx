"use client";

import { useState, type FormEvent } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  CONTACT_CATEGORIES,
  SUPPORT_EMAIL,
  type ContactCategory,
} from "@/lib/legal/content";

interface FormState {
  name: string;
  email: string;
  category: ContactCategory | "";
  message: string;
}

const initialState: FormState = {
  name: "",
  email: "",
  category: "",
  message: "",
};

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [submitted, setSubmitted] = useState(false);

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) {
      nextErrors.name = "Please enter your name.";
    }

    if (!form.email.trim()) {
      nextErrors.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!form.category) {
      nextErrors.category = "Please select a category.";
    }

    if (!form.message.trim()) {
      nextErrors.message = "Please enter a message.";
    } else if (form.message.trim().length < 10) {
      nextErrors.message = "Message must be at least 10 characters.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    const categoryLabel =
      CONTACT_CATEGORIES.find((c) => c.value === form.category)?.label ??
      form.category;

    const subject = encodeURIComponent(
      `Scanonix contact: ${categoryLabel}`,
    );
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nCategory: ${categoryLabel}\n\n${form.message}`,
    );

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-8 text-center">
        <h3 className="text-lg font-semibold text-green-300">
          Your email client should open shortly
        </h3>
        <p className="mt-2 text-sm text-scanonix-muted">
          If it does not open automatically, email us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-scanonix-orange hover:text-scanonix-orange-light"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <ActionButton
          variant="outline"
          className="mt-6"
          onClick={() => {
            setSubmitted(false);
            setForm(initialState);
            setErrors({});
          }}
        >
          Send another message
        </ActionButton>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mb-2 block text-sm font-medium text-white">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-scanonix-orange/50"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {errors.name && (
            <p id="contact-name-error" className="mt-1.5 text-xs text-red-400" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="contact-email" className="mb-2 block text-sm font-medium text-white">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-scanonix-orange/50"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {errors.email && (
            <p id="contact-email-error" className="mt-1.5 text-xs text-red-400" role="alert">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="contact-category" className="mb-2 block text-sm font-medium text-white">
          Category
        </label>
        <select
          id="contact-category"
          value={form.category}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              category: e.target.value as ContactCategory | "",
            }))
          }
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-scanonix-orange/50"
          aria-invalid={Boolean(errors.category)}
          aria-describedby={errors.category ? "contact-category-error" : undefined}
        >
          <option value="">Select a category</option>
          {CONTACT_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
        {errors.category && (
          <p id="contact-category-error" className="mt-1.5 text-xs text-red-400" role="alert">
            {errors.category}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-2 block text-sm font-medium text-white">
          Message
        </label>
        <textarea
          id="contact-message"
          rows={6}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-scanonix-orange/50"
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
        />
        {errors.message && (
          <p id="contact-message-error" className="mt-1.5 text-xs text-red-400" role="alert">
            {errors.message}
          </p>
        )}
      </div>

      <ActionButton type="submit" size="lg" className="w-full sm:w-auto">
        Send message
      </ActionButton>
    </form>
  );
}
