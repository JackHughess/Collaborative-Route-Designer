import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeNext } from "@/lib/auth/safe-next";

export const metadata: Metadata = { title: "Sign up · Route Designer" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthForm mode="signup" next={safeNext(next)} />
    </main>
  );
}
