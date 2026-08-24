// Supabase Edge Function: login-with-username
// Permite inicio de sesión seguro usando Nombre de Usuario sin exponer emails ni crear tablas públicas.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROD_ORIGIN = "https://martaaterry-cloud.github.io";
const DEV_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:8080",
]);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = (origin === PROD_ORIGIN || DEV_ORIGINS.has(origin)) ? origin : PROD_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username, password, captcha_token } = await req.json();

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return new Response(
        JSON.stringify({ error: "Introduce usuario y contraseña válidos." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Configuración del servidor incompleta." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Verificación obligatoria de Cloudflare Turnstile si está configurado el secreto en Supabase
    if (turnstileSecret) {
      const token = typeof captcha_token === "string" ? captcha_token.trim() : "";
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Verificación de seguridad requerida." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      const form = new FormData();
      form.append("secret", turnstileSecret);
      form.append("response", token);
      const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: form,
      });
      const cfData = await cfRes.json();
      if (!cfData || cfData.success !== true) {
        return new Response(
          JSON.stringify({ error: "Verificación de seguridad no válida. Inténtalo de nuevo." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
    }

    // Cliente administrativo exclusivo de servidor
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const cleanUsername = username.trim().toLowerCase();

    // 1. Buscar user_id asociado al username en profiles
    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("user_id")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (profileErr || !profile?.user_id) {
      // Respuesta genérica para evitar enumeración de usuarios
      return new Response(
        JSON.stringify({ error: "Usuario o contraseña incorrectos." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 2. Obtener el email del usuario mediante API administrativa
    const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(profile.user_id);
    if (userErr || !userData?.user?.email) {
      return new Response(
        JSON.stringify({ error: "Usuario o contraseña incorrectos." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 3. Autenticar con anon key verificando contraseña
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authErr } = await anonClient.auth.signInWithPassword({
      email: userData.user.email,
      password: password,
    });

    if (authErr || !authData.session) {
      return new Response(
        JSON.stringify({ error: "Usuario o contraseña incorrectos." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 4. Retornar sesión segura al cliente
    return new Response(
      JSON.stringify({ session: authData.session }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Error en el servidor al autenticar." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
