import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/session";
import { safeCallbackUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage(props: PageProps<"/signup">) {
  const { callbackUrl } = await props.searchParams;
  const returnTo = safeCallbackUrl(
    Array.isArray(callbackUrl) ? callbackUrl[0] : callbackUrl,
  );
  if (await getCurrentUser()) redirect(returnTo);

  return (
    <div className="mx-auto w-full max-w-sm py-4 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        Join to publish your recipes and review others&apos;.
      </p>
      <AuthForm mode="signup" callbackUrl={returnTo} />
    </div>
  );
}
