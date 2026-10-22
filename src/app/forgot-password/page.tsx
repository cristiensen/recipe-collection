import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-reset-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-sm py-4 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight">Forgot password</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        Enter your account&apos;s email and we&apos;ll send you a link to choose
        a new password.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
