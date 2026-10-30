// Hand-written to match supabase/migrations. Regenerate with
// `npx supabase gen types typescript --linked` if the schema grows.

export type Role = "owner" | "editor" | "viewer";
export type InviteRole = Exclude<Role, "owner">;

export interface Database {
  public: {
    Tables: {
      plays: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          ydoc_snapshot: string | null;
          thumbnail_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name?: string;
          ydoc_snapshot?: string | null;
          thumbnail_url?: string | null;
        };
        Update: {
          name?: string;
          thumbnail_url?: string | null;
          ydoc_snapshot?: string | null;
        };
        Relationships: [];
      };
      play_members: {
        Row: {
          play_id: string;
          user_id: string;
          role: Role;
          created_at: string;
        };
        Insert: {
          play_id: string;
          user_id: string;
          role: Role;
        };
        Update: {
          role?: Role;
        };
        Relationships: [
          {
            foreignKeyName: "play_members_play_id_fkey";
            columns: ["play_id"];
            isOneToOne: false;
            referencedRelation: "plays";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          id: string;
          play_id: string;
          email: string | null;
          role: InviteRole;
          token: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          play_id: string;
          role: InviteRole;
          email?: string | null;
          token?: string;
          expires_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      play_role: {
        Args: { p_play_id: string };
        Returns: Role | null;
      };
      get_play_members: {
        Args: { p_play_id: string };
        Returns: { user_id: string; role: Role; email: string; name: string }[];
      };
      accept_invite: {
        Args: { p_token: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
