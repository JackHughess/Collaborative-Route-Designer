import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Collaborative Route Designer</h1>
      <p className="text-center opacity-80">
        Design football plays and edit them together in real time.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="rounded bg-foreground px-4 py-2 text-background">
          Sign in
        </Link>
        <Link href="/dashboard" className="rounded border px-4 py-2">
          My plays
        </Link>
      </div>
    </main>
  );
}
