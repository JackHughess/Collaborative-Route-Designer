"use server";

import { headers } from "next/headers";
import { createClient, requireUser } from "@/lib/supabase/server";
import type { InviteRole, Role } from "@/lib/supabase/types";

// Sharing for the play's owner. RLS enforces that only the owner can create,
// read or delete invites and change or remove members, so these actions don't
// re-check the role themselves.

export interface Member {
  userId: string;
  role: Role;
  email: string;
  name: string;
  isYou: boolean;
}

export interface PendingInvite {
  id: string;
  email: string | null;
  role: InviteRole;
  expiresAt: string;
  url: string;
}

export type SharingResult =
  | { ok: true; members: Member[]; invites: PendingInvite[] }
  | { ok: false; error: string };

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

const isRole = (value: unknown): value is InviteRole =>
  value === "editor" || value === "viewer";

export async function loadSharing(playId: string): Promise<SharingResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const [members, invites] = await Promise.all([
    supabase.rpc("get_play_members", { p_play_id: playId }),
    supabase
      .from("invites")
      .select("id, email, role, token, expires_at")
      .eq("play_id", playId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at"),
  ]);
  if (members.error) return { ok: false, error: members.error.message };
  if (invites.error) return { ok: false, error: invites.error.message };

  const base = await siteUrl();
  return {
    ok: true,
    members: (members.data ?? []).map((m) => ({
      userId: m.user_id,
      role: m.role,
      email: m.email,
      name: m.name,
      isYou: m.user_id === user.id,
    })),
    invites: (invites.data ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expires_at,
      url: `${base}/invite/${i.token}`,
    })),
  };
}

export async function createInvite(
  playId: string,
  role: unknown,
  email: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireUser();
  if (!isRole(role)) return { ok: false, error: "Choose editor or viewer." };
  const label = email.trim().slice(0, 200) || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .insert({ play_id: playId, role, email: label })
    .select("token")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create the invite." };
  }
  return { ok: true, url: `${await siteUrl()}/invite/${data.token}` };
}

export async function revokeInvite(inviteId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("invites").delete().eq("id", inviteId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function changeMemberRole(playId: string, userId: string, role: unknown) {
  await requireUser();
  if (!isRole(role)) return { ok: false as const, error: "Choose editor or viewer." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("play_members")
    .update({ role })
    .eq("play_id", playId)
    .eq("user_id", userId)
    .select("role");
  if (error) return { ok: false as const, error: error.message };
  if (!data?.length) return { ok: false as const, error: "Only the owner can change roles." };
  return { ok: true as const };
}

export async function removeMember(playId: string, userId: string) {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("play_members")
    .delete()
    .eq("play_id", playId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return { ok: false as const, error: error.message };
  if (!data?.length) return { ok: false as const, error: "Could not remove that person." };
  return { ok: true as const };
}
