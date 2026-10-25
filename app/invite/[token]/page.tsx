export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await params;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Accept invite</h1>
    </main>
  );
}
