-- ==========================================================================
-- ORBIT: Migración de Historial de Estados Inmutable y Anti-Pérdida (v1.3.14)
-- ==========================================================================
-- Esta migración crea la tabla `public.orbit_state_history` inmutable desde el
-- cliente (solo SELECT para authenticated), con trigger BEFORE UPDATE que guarda
-- snapshots únicamente cuando orbit_data u orbit_timer cambian realmente
-- (IS DISTINCT FROM), manteniendo las últimas 20 versiones por usuario.
-- ==========================================================================

-- 1. Tabla de Historial de Estados
CREATE TABLE IF NOT EXISTS public.orbit_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  orbit_data JSONB NOT NULL,
  orbit_timer JSONB,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT DEFAULT 'snapshot_before_update'
);

-- Índice para consultas por usuario y orden cronológico descendente
CREATE INDEX IF NOT EXISTS orbit_state_history_user_created_idx 
  ON public.orbit_state_history (user_id, created_at DESC);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.orbit_state_history ENABLE ROW LEVEL SECURITY;

-- 3. Política de RLS: Inmutabilidad para authenticated (SOLO SELECT de sus propias filas)
DROP POLICY IF EXISTS "Users can read own state history" ON public.orbit_state_history;
CREATE POLICY "Users can read own state history"
  ON public.orbit_state_history FOR SELECT
  USING (auth.uid() = user_id);

-- Eliminar explícitamente cualquier política previa de inserción o borrado para usuarios
DROP POLICY IF EXISTS "Users can insert own state history" ON public.orbit_state_history;
DROP POLICY IF EXISTS "Users can delete own state history" ON public.orbit_state_history;

-- 4. Trigger BEFORE UPDATE en public.orbit_state
-- Guarda snapshot solo si hay cambios reales en orbit_data o orbit_timer (IS DISTINCT FROM)
-- y mantiene un límite de 20 versiones por usuario de forma automática.
CREATE OR REPLACE FUNCTION public.handle_orbit_state_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Solo guardar historial si la fila anterior tenía datos Y hubo un cambio real en datos o temporizador
  IF OLD.orbit_data IS NOT NULL AND (
    OLD.orbit_data IS DISTINCT FROM NEW.orbit_data OR
    OLD.orbit_timer IS DISTINCT FROM NEW.orbit_timer
  ) THEN
    INSERT INTO public.orbit_state_history (
      user_id,
      orbit_data,
      orbit_timer,
      source_updated_at,
      created_at,
      reason
    ) VALUES (
      OLD.user_id,
      OLD.orbit_data,
      OLD.orbit_timer,
      OLD.updated_at,
      NOW(),
      'snapshot_before_update'
    );

    -- Mantener únicamente las últimas 20 versiones por usuario
    DELETE FROM public.orbit_state_history
    WHERE id IN (
      SELECT id
      FROM public.orbit_state_history
      WHERE user_id = OLD.user_id
      ORDER BY created_at DESC
      OFFSET 20
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_orbit_state_backup_history ON public.orbit_state;
CREATE TRIGGER trigger_orbit_state_backup_history
  BEFORE UPDATE ON public.orbit_state
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_orbit_state_before_update();

-- 5. Función segura para listar el historial del usuario autenticado (límite acotado entre 1 y 50)
CREATE OR REPLACE FUNCTION public.get_my_orbit_state_history(p_limit INT DEFAULT 20)
RETURNS TABLE (
  history_id UUID,
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  reason TEXT,
  data_preview JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_safe_limit INT;
BEGIN
  v_safe_limit := GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));

  RETURN QUERY
  SELECT 
    h.id AS history_id,
    h.source_updated_at,
    h.created_at,
    h.reason,
    jsonb_build_object(
      'wallet', h.orbit_data->>'wallet',
      'lifetimeStars', h.orbit_data->>'lifetimeStars',
      'since', h.orbit_data->'returnToMe'->>'since',
      'milestonesCount', CASE 
        WHEN jsonb_typeof(h.orbit_data->'returnToMe'->'awardedMilestones') = 'array' 
        THEN jsonb_array_length(h.orbit_data->'returnToMe'->'awardedMilestones') 
        ELSE 0 
      END,
      'journalCount', CASE 
        WHEN jsonb_typeof(h.orbit_data->'journal') = 'array' 
        THEN jsonb_array_length(h.orbit_data->'journal') 
        ELSE 0 
      END,
      'goodThingsCount', CASE 
        WHEN jsonb_typeof(h.orbit_data->'goodThings') = 'array' 
        THEN jsonb_array_length(h.orbit_data->'goodThings') 
        ELSE 0 
      END
    ) AS data_preview
  FROM public.orbit_state_history h
  WHERE h.user_id = auth.uid()
  ORDER BY h.created_at DESC
  LIMIT v_safe_limit;
END;
$$;

-- 6. Función segura para restaurar una versión específica desde el historial
-- Al actualizar orbit_state, el trigger handle_orbit_state_before_update genera automáticamente
-- un snapshot de respaldo del estado que está siendo sustituido.
CREATE OR REPLACE FUNCTION public.restore_orbit_state_from_history(p_history_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_history public.orbit_state_history%ROWTYPE;
  v_rows_affected INT;
BEGIN
  SELECT * INTO v_history
  FROM public.orbit_state_history
  WHERE id = p_history_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versión del historial no encontrada o acceso denegado';
  END IF;

  UPDATE public.orbit_state
  SET 
    orbit_data = v_history.orbit_data,
    orbit_timer = v_history.orbit_timer,
    updated_at = NOW()
  WHERE user_id = auth.uid();

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'No se encontró fila de orbit_state para el usuario autenticado';
  END IF;

  RETURN TRUE;
END;
$$;

-- 7. Concesión y Revocación Explícita de Permisos
-- Inmutabilidad desde el cliente: authenticated SOLO puede hacer SELECT
REVOKE ALL ON TABLE public.orbit_state_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.orbit_state_history TO authenticated;
GRANT ALL ON TABLE public.orbit_state_history TO service_role;

-- Revocación explícita de permisos de ejecución a PUBLIC y anon
REVOKE ALL ON FUNCTION public.get_my_orbit_state_history(INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_orbit_state_from_history(UUID) FROM PUBLIC, anon;

-- Concesión de EXECUTE únicamente a authenticated y service_role
GRANT EXECUTE ON FUNCTION public.get_my_orbit_state_history(INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_orbit_state_from_history(UUID) TO authenticated, service_role;
