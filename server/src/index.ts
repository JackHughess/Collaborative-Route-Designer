import { createTokenVerifier } from "./auth.ts";
import { createCollabServer } from "./server.ts";
import { createSupabaseStore } from "./store.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable ${name}. See .env.example.`);
    process.exit(1);
  }
  return value;
}

const supabaseUrl = required("SUPABASE_URL");

const server = createCollabServer({
  port: Number(process.env.PORT ?? 1234),
  verifyToken: createTokenVerifier({
    supabaseUrl,
    jwtSecret: process.env.SUPABASE_JWT_SECRET || undefined,
  }),
  store: createSupabaseStore({
    supabaseUrl,
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  }),
});

await server.listen();
