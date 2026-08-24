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

// Función auxiliar para listar recursivamente todos los objetos bajo un prefijo
async function listAllFilesRecursively(
  adminClient: any,
  bucket: string,
  rootPrefix: string
): Promise<{ files: string[]; error: string | null }> {
  const allFiles: string[] = [];
  const foldersToScan: string[] = [rootPrefix];

  while (foldersToScan.length > 0) {
    const currentFolder = foldersToScan.shift()!;
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await adminClient.storage
        .from(bucket)
        .list(currentFolder, { limit, offset, sortBy: { column: "name", order: "asc" } });

      if (error) {
        return { files: [], error: `Error al listar carpeta de storage: ${error.message}` };
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        for (const item of data) {
          if (!item.name || item.name === ".emptyFolderPlaceholder") continue;

          const itemPath = currentFolder ? `${currentFolder}/${item.name}` : item.name;
          // En Supabase Storage, si id es null o no tiene metadata, es un directorio
          const isFolder = item.id === null || (!item.metadata && !item.created_at);

          if (isFolder) {
            foldersToScan.push(itemPath);
          } else {
            allFiles.push(itemPath);
          }
        }

        if (data.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }
    }
  }

  return { files: allFiles, error: null };
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
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser(token);
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
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 3. Limpieza de Storage: Listar y borrar recursivamente todos los archivos bajo el prefijo del usuario
    const { files: storageFiles, error: listError } = await listAllFilesRecursively(
      adminClient,
      "orbit-media",
      userId
    );

    if (listError) {
      console.error("[STORAGE_LIST_FAILED]", { error: listError });
      return new Response(
        JSON.stringify({ error: "No se pudieron listar los archivos para su eliminación. Operación cancelada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (storageFiles.length > 0) {
      // Eliminar en lotes de 100 archivos
      for (let i = 0; i < storageFiles.length; i += 100) {
        const batch = storageFiles.slice(i, i + 100);
        const { error: removeErr } = await adminClient.storage
          .from("orbit-media")
          .remove(batch);

        if (removeErr) {
          console.error("[STORAGE_REMOVE_FAILED]", { error: removeErr.message });
          return new Response(
            JSON.stringify({ error: "Fallo al eliminar archivos de almacenamiento. Operación cancelada." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
          );
        }
      }
      console.log("[STORAGE_CLEANUP_OK] Archivos de media eliminados recursivamente");
    } else {
      console.log("[STORAGE_CLEANUP_OK] Sin archivos de media para eliminar");
    }

    // 4. Borrar fila de orbit_state
    const { error: stateErr } = await adminClient
      .from("orbit_state")
      .delete()
      .eq("user_id", userId);

    if (stateErr) {
      console.error("[STATE_DELETE_FAILED]", { code: stateErr.code });
      return new Response(
        JSON.stringify({ error: "Fallo al eliminar los datos de la nube. Operación cancelada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    console.log("[STATE_DELETED] Estado en la nube eliminado");

    // 5. Borrar fila de profiles
    const { error: profileErr } = await adminClient
      .from("profiles")
      .delete()
      .eq("user_id", userId);

    if (profileErr) {
      console.error("[PROFILE_DELETE_FAILED]", { code: profileErr.code });
      return new Response(
        JSON.stringify({ error: "Fallo al eliminar el perfil. Operación cancelada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    console.log("[PROFILE_DELETED] Perfil eliminado");

    // 6. Borrar usuario de auth.users (Solo tras confirmar éxito en pasos 3, 4 y 5)
    const { error: deleteUserErr } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserErr) {
      console.error("[AUTH_USER_DELETE_FAILED]", {
        status: deleteUserErr.status,
        message: deleteUserErr.message,
      });
      return new Response(
        JSON.stringify({ error: "No se pudo completar la eliminación del usuario de autenticación." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    console.log("[AUTH_USER_DELETED] Usuario auth eliminado");

    // 7. Verificación posterior robusta de limpieza
    const { data: remainingState, error: stateCheckErr } = await adminClient
      .from("orbit_state")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (stateCheckErr) {
      console.error("[POST_CHECK_STATE_ERROR]", { code: stateCheckErr.code });
      return new Response(
        JSON.stringify({ error: "Error al verificar la eliminación del estado en la nube." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const { data: remainingProfile, error: profileCheckErr } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileCheckErr) {
      console.error("[POST_CHECK_PROFILE_ERROR]", { code: profileCheckErr.code });
      return new Response(
        JSON.stringify({ error: "Error al verificar la eliminación del perfil." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (remainingState !== null || remainingProfile !== null) {
      console.warn("[POST_CHECK_RESIDUAL_DETECTED]");
      return new Response(
        JSON.stringify({ error: "Se detectaron datos residuales tras la eliminación." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("[DELETE_ACCOUNT_SUCCESS] Proceso de eliminación completado y verificado");

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
