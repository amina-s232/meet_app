"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { PasswordField, TextField } from "./fields";

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be at most 50 characters"),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type FormValues = z.infer<typeof schema>;

const API_FIELDS = ["name", "email", "password"] as const;

export default function SignupForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const email = values.email.trim().toLowerCase();

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name, email, password: values.password }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 409) {
      setError("email", { message: data.error ?? "An account with this email already exists" });
      return;
    }
    if (res.status === 400 && data.details) {
      const details = data.details as Record<string, string[] | undefined>;
      for (const field of API_FIELDS) {
        const message = details[field]?.[0];
        if (message) setError(field, { message });
      }
      return;
    }
    if (!res.ok) {
      setServerError(data.error ?? "Could not create your account. Please try again.");
      return;
    }

    // Account created: sign in straight away
    const login = await signIn("credentials", { email, password: values.password, redirect: false });
    if (!login || login.error) {
      router.push("/login");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <TextField
        label="Full name"
        autoComplete="name"
        placeholder="Amina Khan"
        error={errors.name?.message}
        {...register("name")}
      />

      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register("email")}
      />

      <PasswordField
        label="Password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={errors.password?.message}
        {...register("password")}
      />

      <PasswordField
        label="Confirm password"
        autoComplete="new-password"
        placeholder="Repeat your password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-70"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account
      </button>
    </form>
  );
}