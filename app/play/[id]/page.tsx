import type { Metadata } from "next";
import { PlayEditor } from "@/components/editor/PlayEditor";
import { createClient, requireUser } from "@/lib/supabase/server";
import { NoAccess } from "./NoAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadPlay(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const [{ data: play }, { data: role }] = await Promise.all([
    supabase
      .from("plays")
      .select("id, name, ydoc_snapshot")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("play_role", { p_play_id: id }),
  ]);
  return play && role ? { ...play, role } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const play = await loadPlay(id);
  return { title: `${play?.name ?? "Play"} · Route Designer` };
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/play/${id}`);
  const play = await loadPlay(id);

  // RLS hides plays you aren't a member of, so "missing" and "no access" look
  // the same from here, and we don't reveal which it is.
  if (!play) return <NoAccess />;

  return (
    <PlayEditor
      playId={play.id}
      snapshot={play.ydoc_snapshot}
      role={play.role}
      user={user}
    />
  );
}
