import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeNext } from "@/lib/auth/safe-next";

export const metadata: Metadata = { title: "Sign in · Route Designer" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthForm mode="login" next={safeNext(next)} error={error} />
    </main>
  );
}
