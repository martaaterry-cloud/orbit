// Supabase Edge Function: delete-account
// Permite al usuario autenticado eliminar definitivamente su propia cuenta y todos sus datos.
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

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  console.log("[DELETE_ACCOUNT_START] Solicitud de eliminación recibida");

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      console.warn("[DELETE_ACCOUNT_UNAUTHORIZED] Cabecera Authorization ausente o inválida");
      return new Response(
        JSON.stringify({ error: "No autorizado. Sesión requerida." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("[ENV_CHECK_FAILED] Variables de entorno incompletas");
      return new Response(
        JSON.stringify({ error: "Error en la configuración del servidor." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // 1. Validar la identidad del usuario a partir de su JWT (nunca desde un user_id del body)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user?.id) {
      console.warn("[AUTH_VERIFICATION_FAILED]", { status: userErr?.status || 401 });
      return new Response(
        JSON.stringify({ error: "Sesión no válida o expirada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = user.id;
    console.log("[AUTH_VERIFIED] Identidad del usuario verificada correctamente");

    // 2. Cliente administrativo con service_role para ejecutar la eliminación ordenada
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 3. Limpieza de Storage: Borrar todos los archivos bajo el prefijo exacto del usuario
    try {
      let allPaths: string[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const { data: fileList, error: listErr } = await adminClient.storage
          .from("orbit-media")
          .list(userId, { limit, offset });

        if (listErr) {
          console.warn("[STORAGE_LIST_FAILED]", { message: "Error al listar archivos" });
          break;
        }

        if (!fileList || fileList.length === 0) {
          hasMore = false;
        } else {
          for (const f of fileList) {
            if (f.name && f.name !== ".emptyFolderPlaceholder") {
              allPaths.push(`${userId}/${f.name}`);
            }
          }
          if (fileList.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        }
      }

      if (allPaths.length > 0) {
        const { error: removeErr } = await adminClient.storage
          .from("orbit-media")
          .remove(allPaths);

        if (removeErr) {
          console.warn("[STORAGE_REMOVE_FAILED]", { message: "Fallo al remover algunos archivos" });
        } else {
          console.log("[STORAGE_CLEANUP_OK] Archivos de media eliminados");
        }
      } else {
        console.log("[STORAGE_CLEANUP_OK] Sin archivos de media para eliminar");
      }
    } catch (storageErr) {
      console.warn("[STORAGE_CLEANUP_ERROR]", { message: "Excepción en limpieza de storage" });
    }

    // 4. Borrar fila de orbit_state
    const { error: stateErr } = await adminClient
      .from("orbit_state")
      .delete()
      .eq("user_id", userId);

    if (stateErr) {
      console.warn("[STATE_DELETE_FAILED]", { code: stateErr.code });
    } else {
      console.log("[STATE_DELETED] Estado en la nube eliminado");
    }

    // 5. Borrar fila de profiles
    const { error: profileErr } = await adminClient
      .from("profiles")
      .delete()
      .eq("user_id", userId);

    if (profileErr) {
      console.warn("[PROFILE_DELETE_FAILED]", { code: profileErr.code });
    } else {
      console.log("[PROFILE_DELETED] Perfil eliminado");
    }

    // 6. Borrar usuario de auth.users (Paso crítico definitivo)
    const { error: deleteUserErr } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserErr) {
      console.error("[AUTH_USER_DELETE_FAILED]", { status: deleteUserErr.status, message: deleteUserErr.message });
      return new Response(
        JSON.stringify({ error: "No se pudo completar la eliminación de la cuenta. Inténtalo de nuevo." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("[AUTH_USER_DELETED] Usuario auth eliminado");
    console.log("[DELETE_ACCOUNT_SUCCESS] Proceso de eliminación completado con éxito");

    return new Response(
      JSON.stringify({ success: true, message: "Cuenta eliminada correctamente." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("[UNEXPECTED_ERROR]", { name: (err as Error)?.name || "UnknownError" });
    return new Response(
      JSON.stringify({ error: "Error en el servidor durante la eliminación." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
