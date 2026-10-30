"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  message?: string;
}

async function siteOrigin() {
  const origin = (await headers()).get("origin");
  return origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: safeNext(formData.get("next")),
  };
}

/** Single entry point for the auth form, picked by its `intent` field. */
export async function submitAuth(
  prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  switch (formData.get("intent")) {
    case "signup":
      return signUp(prev, formData);
    case "magic-link":
      return sendMagicLink(prev, formData);
    default:
      return signIn(prev, formData);
  }
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(next);
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);
  const name = String(formData.get("name") ?? "").trim();
  if (!email || !password) return { error: "Enter your email and password." };
  if (password.length < 8) {
    return { error: "Use a password of at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl(await siteOrigin(), next),
      data: name ? { full_name: name } : undefined,
    },
  });
  if (error) return { error: error.message };

  // With email confirmation off, sign-up returns a session straight away.
  if (data.session) redirect(next);
  return { message: "Check your email for a link to confirm your account." };
}

export async function sendMagicLink(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, next } = readCredentials(formData);
  if (!email) return { error: "Enter your email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(await siteOrigin(), next) },
  });
  if (error) return { error: error.message };
  return { message: "Check your email for a sign-in link." };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(await siteOrigin(), next) },
  });
  if (error || !data.url) {
    redirect(
      `/login?error=${encodeURIComponent(error?.message ?? "Google sign-in failed")}`,
    );
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
