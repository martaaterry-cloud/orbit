-- ==========================================================================
-- ORBIT: Migración de Historial de Estados y Seguridad Anti-Pérdida (v1.3.13)
-- ==========================================================================
-- Esta migración crea la tabla `public.orbit_state_history` para almacenar
-- automáticamente snapshots previos antes de cualquier sobreescritura de
-- `orbit_state`, garantizando recuperación, RLS estricto y límite de 20 versiones.
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

-- Índice para consultas eficientes por usuario y orden cronológico
CREATE INDEX IF NOT EXISTS orbit_state_history_user_created_idx 
  ON public.orbit_state_history (user_id, created_at DESC);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.orbit_state_history ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS (cada usuario solo accede a su propio historial)
DROP POLICY IF EXISTS "Users can read own state history" ON public.orbit_state_history;
CREATE POLICY "Users can read own state history"
  ON public.orbit_state_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own state history" ON public.orbit_state_history;
CREATE POLICY "Users can insert own state history"
  ON public.orbit_state_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own state history" ON public.orbit_state_history;
CREATE POLICY "Users can delete own state history"
  ON public.orbit_state_history FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Trigger BEFORE UPDATE en public.orbit_state
-- Guarda automáticamente una copia de la fila anterior antes de sobreescribirla
-- y mantiene un límite de 20 versiones máximas por usuario.
CREATE OR REPLACE FUNCTION public.handle_orbit_state_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Solo guardar historial si la fila anterior existía y contenía datos reales
  IF OLD.orbit_data IS NOT NULL THEN
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

-- 5. Función de servidor para listar versiones del usuario actual
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
BEGIN
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
      'milestonesCount', jsonb_array_length(COALESCE(h.orbit_data->'returnToMe'->'awardedMilestones', '[]'::jsonb)),
      'journalCount', jsonb_array_length(COALESCE(h.orbit_data->'journal', '[]'::jsonb)),
      'goodThingsCount', jsonb_array_length(COALESCE(h.orbit_data->'goodThings', '[]'::jsonb))
    ) AS data_preview
  FROM public.orbit_state_history h
  WHERE h.user_id = auth.uid()
  ORDER BY h.created_at DESC
  LIMIT LEAST(p_limit, 50);
END;
$$;

-- 6. Función de servidor para restaurar una versión específica desde el historial
CREATE OR REPLACE FUNCTION public.restore_orbit_state_from_history(p_history_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_history public.orbit_state_history%ROWTYPE;
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

  RETURN TRUE;
END;
$$;

-- 7. Concesión de Permisos
GRANT SELECT, INSERT, DELETE ON TABLE public.orbit_state_history TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.orbit_state_history TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_orbit_state_history(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_orbit_state_from_history(UUID) TO authenticated;
