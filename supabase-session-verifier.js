"use strict";

// A5-1 (sesión 164), pendiente 2 de A5_ACTIVATION.md: "conectar un verificador de sesión real".
// Antes de esta sesión, FINANCE_AUTH_VERIFY_URL exigía desplegar un tercer servicio aparte que
// nadie había construido. El hogar ya tiene un proveedor de identidad real y en producción
// (Supabase Auth, el mismo que sostiene la sincronización multidispositivo) — verificar el token
// contra su propio endpoint auth/v1/user evita inventar un servicio nuevo solo para esto, mismo
// criterio que E9-1 (household writes) usó para evitar desplegar backend/server.mjs.
//
// No comprueba aquí permisos de hogar/rol: eso ya lo hacen las funciones `security definer` de
// Supabase (finance_household_role, etc.) usando el JWT propio de quien llama, con RLS de por
// medio. Esta función solo responde "¿es una sesión de verdad, y de quién?".

const text = (value) => String(value ?? "").trim();

async function verifySupabaseSession({ fetch: fetchImpl, supabaseUrl, supabaseAnonKey, authorization, timeoutMs = 10000 } = {}) {
  const url = text(supabaseUrl);
  const anonKey = text(supabaseAnonKey);
  const bearer = text(authorization);
  if (!url || !anonKey) return { allowed: false, reason: "supabase-verifier-not-configured" };
  if (!bearer.startsWith("Bearer ")) return { allowed: false, reason: "bearer-required" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || 10000));
  try {
    const response = await fetchImpl(`${url.replace(/\/+$/, "")}/auth/v1/user`, {
      method: "GET",
      headers: { authorization: bearer, apikey: anonKey },
      signal: controller.signal,
    });
    if (!response.ok) return { allowed: false, reason: "session-invalid-or-expired" };
    const user = await response.json();
    const userId = text(user?.id);
    if (!userId) return { allowed: false, reason: "session-invalid-or-expired" };
    return { allowed: true, userId };
  } catch (error) {
    return { allowed: false, reason: error?.name === "AbortError" ? "auth-verifier-timeout" : "auth-verifier-unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { verifySupabaseSession };
