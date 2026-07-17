import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  testDatabaseConnection,
  validateDatabaseConfig,
} from "./supabaseServer";

/**
 * Compatibility facade for the authentication test suite.
 * The application uses supabaseServer.ts as its canonical implementation.
 */
export { createSupabaseAdminClient } from "./supabaseServer";

export async function createSupabaseClientWithAuth() {
  return createSupabaseServerClient();
}

export function createSupabaseServerActionClient() {
  return createSupabaseServerClient();
}

export async function createSupabaseSessionCheckClient() {
  const client = createSupabaseServerClient();
  const {
    data: { session },
  } = await client.auth.getSession();

  return { client, session, method: "getSession" };
}

export async function testSupabaseConnection() {
  const success = await testDatabaseConnection();

  return {
    success,
    message: success
      ? "Supabase connection successful"
      : "Supabase connection failed",
  };
}

export async function performHealthCheck() {
  const config = validateDatabaseConfig();
  const connection = config.isValid
    ? { success: await testDatabaseConnection() }
    : { success: false };

  return {
    environment: {
      hasUrl: config.isValid || !config.errors.includes("NEXT_PUBLIC_SUPABASE_URL is required"),
      hasAnonKey: config.isValid || !config.errors.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
      hasServiceKey: config.isValid || !config.errors.includes("SUPABASE_SERVICE_ROLE_KEY is required"),
    },
    connection,
  };
}
