import type { Peer, PresenceUser } from "@/lib/play/presence";

function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

/** "Who's here": you plus everyone else connected, one avatar per person. */
export function PresenceAvatars({
  me,
  peers,
}: {
  me: PresenceUser;
  peers: readonly Peer[];
}) {
  const others = new Map<string, PresenceUser>();
  for (const peer of peers) {
    if (peer.user.id !== me.id) others.set(peer.user.id, peer.user);
  }
  const people = [me, ...others.values()];
  const shown = people.slice(0, 5);
  const extra = people.length - shown.length;
  const names = people.map((p) => (p.id === me.id ? `${p.name} (you)` : p.name));

  return (
    <div className="flex items-center" aria-label={`Here now: ${names.join(", ")}`} role="group">
      <ul className="flex -space-x-2">
        {shown.map((person) => (
          <li
            key={person.id}
            title={person.id === me.id ? `${person.name} (you)` : person.name}
            className="flex size-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white dark:border-zinc-950"
            style={{ backgroundColor: person.color }}
          >
            <span aria-hidden="true">{initials(person.name)}</span>
          </li>
        ))}
      </ul>
      {extra > 0 && (
        <span className="ml-1 text-xs text-zinc-500" aria-hidden="true">
          +{extra}
        </span>
      )}
    </div>
  );
}
