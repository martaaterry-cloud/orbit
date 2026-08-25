-- ==========================================================================
-- ORBIT: Migración de Retención a 10 Snapshots por Usuario (v1.3.20)
-- ==========================================================================
-- 1. Actualiza `handle_orbit_state_before_update` para retener las 10 versiones
--    más recientes en orden cronológico (created_at DESC, id DESC).
-- 2. Actualiza `create_manual_state_snapshot` para retener las 10 versiones
--    más recientes en total (compartiendo el mismo límite único).
-- 3. Actualiza `get_my_orbit_state_history` con DEFAULT 10 y límite máx. 10.
-- ==========================================================================

-- 1. Trigger BEFORE UPDATE en public.orbit_state
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

    -- Podar versiones antiguas manteniendo únicamente las 10 más recientes por usuario
    DELETE FROM public.orbit_state_history
     WHERE user_id = OLD.user_id
       AND id NOT IN (
         SELECT id
           FROM public.orbit_state_history
          WHERE user_id = OLD.user_id
          ORDER BY created_at DESC, id DESC
          LIMIT 10
       );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Función RPC para crear copia de seguridad manual segura con límite de 10
CREATE OR REPLACE FUNCTION public.create_manual_state_snapshot(p_label TEXT DEFAULT 'manual_backup')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID;
  v_current_data JSONB;
  v_current_timer JSONB;
  v_current_updated_at TIMESTAMPTZ;
  v_prev_data JSONB;
  v_clean_label TEXT;
  v_history_id UUID;
  
  -- Métricas para validación defensiva
  v_cur_lifetime NUMERIC;
  v_prev_lifetime NUMERIC;
  v_cur_milestones INT;
  v_prev_milestones INT;
  v_cur_regions INT;
  v_prev_regions INT;
  v_cur_goods INT;
  v_prev_goods INT;
  v_cur_journals INT;
  v_prev_journals INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- 1. Leer estado actual de orbit_state
  SELECT orbit_data, orbit_timer, updated_at
    INTO v_current_data, v_current_timer, v_current_updated_at
    FROM public.orbit_state
   WHERE user_id = v_user_id;

  IF v_current_data IS NULL THEN
    RAISE EXCEPTION 'No existe un estado previo en la nube para este usuario';
  END IF;

  -- 2. Obtener el último snapshot previo del historial (orden cronológico) para comprobar invariantes
  SELECT orbit_data
    INTO v_prev_data
    FROM public.orbit_state_history
   WHERE user_id = v_user_id
   ORDER BY created_at DESC, id DESC
   LIMIT 1;

  IF v_prev_data IS NOT NULL THEN
    -- Extraer métricas de forma segura con validación de tipos
    v_cur_lifetime := CASE 
      WHEN (v_current_data->>'lifetimeStars') ~ '^-?[0-9]+(\.[0-9]+)?$' 
      THEN (v_current_data->>'lifetimeStars')::NUMERIC 
      ELSE 0 
    END;

    v_prev_lifetime := CASE 
      WHEN (v_prev_data->>'lifetimeStars') ~ '^-?[0-9]+(\.[0-9]+)?$' 
      THEN (v_prev_data->>'lifetimeStars')::NUMERIC 
      ELSE 0 
    END;

    v_cur_milestones := CASE 
      WHEN jsonb_typeof(v_current_data->'returnToMe'->'awardedMilestones') = 'array' 
      THEN jsonb_array_length(v_current_data->'returnToMe'->'awardedMilestones') 
      ELSE 0 
    END;

    v_prev_milestones := CASE 
      WHEN jsonb_typeof(v_prev_data->'returnToMe'->'awardedMilestones') = 'array' 
      THEN jsonb_array_length(v_prev_data->'returnToMe'->'awardedMilestones') 
      ELSE 0 
    END;

    v_cur_regions := CASE 
      WHEN jsonb_typeof(v_current_data->'unlockedRegions') = 'array' 
      THEN jsonb_array_length(v_current_data->'unlockedRegions') 
      ELSE 1 
    END;

    v_prev_regions := CASE 
      WHEN jsonb_typeof(v_prev_data->'unlockedRegions') = 'array' 
      THEN jsonb_array_length(v_prev_data->'unlockedRegions') 
      ELSE 1 
    END;

    v_cur_goods := CASE 
      WHEN jsonb_typeof(v_current_data->'goodThings') = 'array' 
      THEN jsonb_array_length(v_current_data->'goodThings') 
      ELSE 0 
    END;

    v_prev_goods := CASE 
      WHEN jsonb_typeof(v_prev_data->'goodThings') = 'array' 
      THEN jsonb_array_length(v_prev_data->'goodThings') 
      ELSE 0 
    END;

    v_cur_journals := CASE 
      WHEN jsonb_typeof(v_current_data->'journal') = 'array' 
      THEN jsonb_array_length(v_current_data->'journal') 
      ELSE 0 
    END;

    v_prev_journals := CASE 
      WHEN jsonb_typeof(v_prev_data->'journal') = 'array' 
      THEN jsonb_array_length(v_prev_data->'journal') 
      ELSE 0 
    END;

    -- GUARDIA 1: Caída sospechosa en estrellas acumuladas
    IF v_prev_lifetime > 0 AND v_cur_lifetime < (v_prev_lifetime - 0.5) THEN
      RAISE EXCEPTION 'El estado actual presenta una reducción sospechosa en estrellas acumuladas (prev: %, actual: %)', v_prev_lifetime, v_cur_lifetime;
    END IF;

    -- GUARDIA 2: Pérdida de hitos de racha
    IF v_prev_milestones > 0 AND v_cur_milestones < v_prev_milestones THEN
      RAISE EXCEPTION 'El estado actual presenta una pérdida de hitos de racha concedidos (prev: %, actual: %)', v_prev_milestones, v_cur_milestones;
    END IF;

    -- GUARDIA 3: Pérdida de regiones desbloqueadas
    IF v_prev_regions > 1 AND v_cur_regions < v_prev_regions THEN
      RAISE EXCEPTION 'El estado actual presenta una pérdida de regiones celestes (prev: %, actual: %)', v_prev_regions, v_cur_regions;
    END IF;

    -- GUARDIA 4: Estado vacío cuando antes había datos consistentes (>= 3 recuerdos o diario)
    IF (v_prev_goods >= 3 OR v_prev_journals >= 3) AND (v_cur_goods = 0 AND v_cur_journals = 0) THEN
      RAISE EXCEPTION 'El estado actual parece vacío frente al historial previo';
    END IF;
  END IF;

  -- 3. Sanitizar etiqueta
  v_clean_label := REGEXP_REPLACE(COALESCE(p_label, 'manual_backup'), '[^a-zA-Z0-9_\-]', '', 'g');
  IF LENGTH(v_clean_label) = 0 THEN
    v_clean_label := 'manual_backup';
  END IF;
  IF LENGTH(v_clean_label) > 30 THEN
    v_clean_label := SUBSTRING(v_clean_label FROM 1 FOR 30);
  END IF;

  -- 4. Insertar snapshot manual
  INSERT INTO public.orbit_state_history (
    user_id,
    orbit_data,
    orbit_timer,
    source_updated_at,
    created_at,
    reason
  ) VALUES (
    v_user_id,
    v_current_data,
    v_current_timer,
    COALESCE(v_current_updated_at, NOW()),
    NOW(),
    'manual:' || v_clean_label
  ) RETURNING id INTO v_history_id;

  -- 5. Podar versiones antiguas manteniendo únicamente las 10 más recientes por usuario
  DELETE FROM public.orbit_state_history
   WHERE user_id = v_user_id
     AND id NOT IN (
       SELECT id
         FROM public.orbit_state_history
        WHERE user_id = v_user_id
        ORDER BY created_at DESC, id DESC
        LIMIT 10
     );

  RETURN jsonb_build_object(
    'ok', true,
    'history_id', v_history_id,
    'reason', 'manual:' || v_clean_label,
    'created_at', NOW()
  );
END;
$$;

-- 3. Función para consultar el historial con límite de hasta 10 versiones
CREATE OR REPLACE FUNCTION public.get_my_orbit_state_history(p_limit INT DEFAULT 10)
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
  v_safe_limit := GREATEST(1, LEAST(COALESCE(p_limit, 10), 10));

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
  ORDER BY h.created_at DESC, h.id DESC
  LIMIT v_safe_limit;
END;
$$;

-- 4. Permisos de Ejecución
REVOKE ALL ON FUNCTION public.create_manual_state_snapshot(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_state_snapshot(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_orbit_state_history(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_orbit_state_history(INT) TO authenticated, service_role;
