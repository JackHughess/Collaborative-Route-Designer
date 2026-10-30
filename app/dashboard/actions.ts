"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPlayDoc } from "@/lib/play/commands";
import { DEFAULT_FORMATION_ID, getFormation } from "@/lib/play/formations";
import { encodeDoc, toByteaHex } from "@/lib/play/schema";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function createPlay(formData: FormData) {
  await requireUser();
  const name =
    String(formData.get("name") ?? "")
      .trim()
      .slice(0, 120) || "Untitled play";
  const formationId = String(formData.get("formation") ?? DEFAULT_FORMATION_ID);
  const formation = getFormation(formationId)?.id ?? DEFAULT_FORMATION_ID;

  // The play is created with its starting document, so it is never empty.
  const doc = createPlayDoc({ name, formation });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plays")
    .insert({ name, ydoc_snapshot: toByteaHex(encodeDoc(doc)) })
    .select("id")
    .single();
  doc.destroy();

  if (error || !data) {
    redirect(
      `/dashboard?error=${encodeURIComponent(error?.message ?? "Could not create the play")}`,
    );
  }
  redirect(`/play/${data.id}`);
}

export async function deletePlay(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  // RLS only lets the owner delete; for anyone else this deletes nothing.
  const { error } = await supabase.from("plays").delete().eq("id", id);
  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard");
}

export async function leavePlay(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("play_members")
    .delete()
    .eq("play_id", id)
    .eq("user_id", user.id);
  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard");
}
