-- ==========================================================================
-- ORBIT: Migración de Retención a 100 Snapshots y Copias Seguras (v1.3.18)
-- ==========================================================================
-- 1. Amplía el historial de snapshots de 20 a 100 versiones por usuario.
-- 2. Enriquece la función de consulta `get_my_orbit_state_history`.
-- 3. Crea la función RPC segura `create_manual_state_snapshot` que toma
--    un snapshot server-side del estado actual de orbit_state sin modificar
--    la fila principal ni sus marcas de tiempo.
-- ==========================================================================

-- 1. Actualizar Trigger BEFORE UPDATE para retener hasta 100 versiones
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

    -- Mantener únicamente las últimas 100 versiones por usuario
    DELETE FROM public.orbit_state_history
    WHERE id IN (
      SELECT id
      FROM public.orbit_state_history
      WHERE user_id = OLD.user_id
      ORDER BY created_at DESC
      OFFSET 100
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Función RPC segura para crear snapshot manual server-side
-- Lee exclusivamente la fila actual de orbit_state en el servidor para auth.uid(),
-- la inserta en orbit_state_history con label sanitizado y aplica límite de 100.
-- No modifica orbit_state ni orbit_state.updated_at.
CREATE OR REPLACE FUNCTION public.create_manual_state_snapshot(p_label TEXT DEFAULT 'manual_backup')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_state public.orbit_state%ROWTYPE;
  v_history_id UUID;
  v_clean_label TEXT;
  v_created_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT * INTO v_state
  FROM public.orbit_state
  WHERE user_id = auth.uid();

  IF NOT FOUND OR v_state.orbit_data IS NULL THEN
    RAISE EXCEPTION 'No se encontró estado en la nube para crear copia segura';
  END IF;

  -- Sanitizar y limitar longitud del label
  v_clean_label := 'manual:' || COALESCE(NULLIF(regexp_replace(LEFT(TRIM(p_label), 30), '[^a-zA-Z0-9_\- ]', '', 'g'), ''), 'backup');
  v_created_at := NOW();

  INSERT INTO public.orbit_state_history (
    user_id,
    orbit_data,
    orbit_timer,
    source_updated_at,
    created_at,
    reason
  ) VALUES (
    v_state.user_id,
    v_state.orbit_data,
    v_state.orbit_timer,
    v_state.updated_at,
    v_created_at,
    v_clean_label
  ) RETURNING id INTO v_history_id;

  -- Mantener límite de 100 snapshots por usuario
  DELETE FROM public.orbit_state_history
  WHERE id IN (
    SELECT id
    FROM public.orbit_state_history
    WHERE user_id = auth.uid()
    ORDER BY created_at DESC
    OFFSET 100
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'history_id', v_history_id,
    'created_at', v_created_at,
    'reason', v_clean_label,
    'source_updated_at', v_state.updated_at
  );
END;
$$;

-- 3. Actualizar función para listar el historial con límite de hasta 100 y métricas enriquecidas
CREATE OR REPLACE FUNCTION public.get_my_orbit_state_history(p_limit INT DEFAULT 50)
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
  v_safe_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));

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
      END,
      'urgesCount', CASE 
        WHEN jsonb_typeof(h.orbit_data->'urges') = 'array' 
        THEN jsonb_array_length(h.orbit_data->'urges') 
        ELSE 0 
      END,
      'regionsCount', CASE 
        WHEN jsonb_typeof(h.orbit_data->'unlockedRegions') = 'array' 
        THEN jsonb_array_length(h.orbit_data->'unlockedRegions') 
        ELSE 1 
      END
    ) AS data_preview
  FROM public.orbit_state_history h
  WHERE h.user_id = auth.uid()
  ORDER BY h.created_at DESC
  LIMIT v_safe_limit;
END;
$$;

-- 4. Permisos de Ejecución
REVOKE ALL ON FUNCTION public.create_manual_state_snapshot(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_state_snapshot(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_orbit_state_history(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_orbit_state_history(INT) TO authenticated, service_role;
