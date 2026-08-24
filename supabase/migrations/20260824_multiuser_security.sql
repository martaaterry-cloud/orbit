-- ==========================================================================
-- ORBIT: Migración de Seguridad Multiusuario y Perfiles (v1.2.40)
-- ==========================================================================
-- Esta migración crea la tabla de perfiles privados con usernames únicos,
-- normalización forzada a minúsculas, políticas RLS estrictas, trigger de registro
-- y backfill seguro para cuentas existentes en auth.users.
-- ==========================================================================

-- 1. Tabla de Perfiles Privados
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,20}$')
);

-- Asegurar unicidad insensible a mayúsculas
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx ON public.profiles (LOWER(username));

-- 2. Habilitar RLS estricto en perfiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS en profiles (cada usuario solo ve y modifica su propia fila)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Función normal (sin SECURITY DEFINER) para normalizar username a minúsculas en updates
CREATE OR REPLACE FUNCTION public.handle_profile_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.username := LOWER(TRIM(NEW.username));
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_normalize_profile_username ON public.profiles;
CREATE TRIGGER trigger_normalize_profile_username
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_before_write();

-- 5. Función y Trigger para crear perfil automáticamente al registrarse en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_raw_username TEXT;
  v_clean_username TEXT;
  v_display_name TEXT;
BEGIN
  v_raw_username := NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), '');
  v_display_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), '');

  IF v_raw_username IS NOT NULL THEN
    v_clean_username := LOWER(REGEXP_REPLACE(v_raw_username, '[^a-zA-Z0-9_]', '', 'g'));
    IF LENGTH(v_clean_username) < 3 THEN
      v_clean_username := 'user_' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8);
    END IF;
  ELSE
    v_clean_username := 'user_' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8);
  END IF;

  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (NEW.id, v_clean_username, COALESCE(v_display_name, v_clean_username))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- Revocar permisos de ejecución pública a funciones del sistema
REVOKE ALL ON FUNCTION public.handle_new_user_signup() FROM PUBLIC, anon, authenticated;

-- 6. Backfill seguro para usuarios ya existentes en auth.users
-- Crea el registro de perfil para cuentas existentes previas a la migración
INSERT INTO public.profiles (user_id, username, display_name)
SELECT 
  u.id,
  COALESCE(
    NULLIF(LOWER(REGEXP_REPLACE(u.raw_user_meta_data->>'username', '[^a-zA-Z0-9_]', '', 'g')), ''),
    'user_' || SUBSTRING(u.id::TEXT FROM 1 FOR 8)
  ) AS username,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'username'), ''),
    'Viajero Orbit'
  ) AS display_name
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;
