import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { buttonPrimary } from "@/components/ui";
import { createClient, requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join a play · Route Designer" };

async function acceptInvite(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  await requireUser(`/invite/${token}`);
  const supabase = await createClient();
  // Runs as the signed-in user; accept_invite() validates the token, adds the
  // membership and deletes the invite in one transaction.
  const { data: playId, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error || !playId) {
    redirect(`/invite/${encodeURIComponent(token)}?error=1`);
  }
  redirect(`/play/${playId}`);
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const user = await requireUser(`/invite/${token}`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_preview", { p_token: token });
  const invite = data?.[0];

  return (
    <>
      <AppHeader email={user.email} />
      <main className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5 text-center">
          {!invite || error ? (
            <>
              <h1 className="text-2xl font-semibold">This invite link doesn&apos;t work</h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                It may have expired, been used already, or been revoked. Ask the person
                who shared it for a new link.
              </p>
              <Link href="/dashboard" className={buttonPrimary}>
                Go to my plays
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">
                Join &ldquo;{invite.play_name}&rdquo;
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                You&apos;ve been invited as {invite.role === "editor" ? "an" : "a"}{" "}
                <strong>{invite.role}</strong>.{" "}
                {invite.role === "editor"
                  ? "You'll be able to edit the play with others in real time."
                  : "You'll be able to watch edits live and run the play."}
              </p>
              {invite.already_member && (
                <p className="text-sm text-zinc-500">
                  You already have access. Accepting keeps your current role unless this
                  invite gives you more.
                </p>
              )}
              <p className="text-sm text-zinc-500">Signed in as {user.email}</p>
              <form action={acceptInvite}>
                <input type="hidden" name="token" value={token} />
                <button type="submit" className={buttonPrimary}>
                  Accept and open the play
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}
