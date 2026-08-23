-- ============================================
-- SSPI Smart QR Attendance System
-- MIGRATION: Daily QR + Token Attendance
-- ============================================

-- 1. Add new columns for daily attendance to the sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS attendance_type TEXT DEFAULT 'subject' CHECK (attendance_type IN ('subject', 'daily'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_type TEXT CHECK (session_type IN ('morning', 'afternoon'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS division TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_date DATE DEFAULT CURRENT_DATE;

-- 2. Make subject fields nullable to allow daily attendance sessions
ALTER TABLE sessions ALTER COLUMN subject_id DROP NOT NULL;
ALTER TABLE sessions ALTER COLUMN subject_name DROP NOT NULL;

-- 3. Add constraint to ensure data consistency
-- Note: We drop the constraint first if it exists so we can re-run this migration safely
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS chk_sessions_attendance_type_data;
ALTER TABLE sessions ADD CONSTRAINT chk_sessions_attendance_type_data 
CHECK (
  (attendance_type = 'subject' AND subject_id IS NOT NULL AND subject_name IS NOT NULL)
  OR
  (attendance_type = 'daily' AND session_type IS NOT NULL)
);

-- 4. Replace create_attendance_session to handle daily attendance fields
CREATE OR REPLACE FUNCTION create_attendance_session(
  p_teacher_id      UUID,
  p_department      TEXT,
  p_year            INTEGER,
  p_semester        INTEGER,
  p_subject_id      UUID,
  p_subject_name    TEXT,
  p_qr_token        TEXT,
  p_expires_at      TIMESTAMPTZ,
  p_teacher_lat     NUMERIC,
  p_teacher_lng     NUMERIC,
  p_teacher_accuracy NUMERIC DEFAULT NULL,
  p_radius_meters   NUMERIC DEFAULT 10,
  p_attendance_type TEXT DEFAULT 'subject',
  p_session_type    TEXT DEFAULT NULL,
  p_division        TEXT DEFAULT NULL,
  p_session_date    DATE DEFAULT CURRENT_DATE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allowed   BOOLEAN;
  v_session   sessions;
  v_max_distance_meters NUMERIC := 10;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff WHERE id = p_teacher_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Teacher account not found or inactive.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM staff_departments
    WHERE staff_id = p_teacher_id AND department_code = p_department
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are not assigned to this department.');
  END IF;

  IF p_teacher_lat IS NULL OR p_teacher_lng IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Your location is required to start a session. Please enable GPS.');
  END IF;

  -- Validate based on attendance_type
  IF p_attendance_type = 'subject' AND (p_subject_id IS NULL OR p_subject_name IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Subject details are required for subject attendance.');
  END IF;

  IF p_attendance_type = 'daily' AND p_session_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session type (morning/afternoon) is required for daily attendance.');
  END IF;

  INSERT INTO sessions (
    teacher_id, department, year, semester, subject_id, subject_name,
    qr_token, expires_at, status, teacher_lat, teacher_lng,
    teacher_gps_accuracy, gps_radius_meters, 
    attendance_type, session_type, division, session_date
  ) VALUES (
    p_teacher_id, p_department, p_year, p_semester, p_subject_id, p_subject_name,
    p_qr_token, p_expires_at, 'active', p_teacher_lat, p_teacher_lng,
    p_teacher_accuracy, v_max_distance_meters,
    p_attendance_type, p_session_type, p_division, p_session_date
  )
  RETURNING * INTO v_session;

  RETURN jsonb_build_object('success', true, 'session', to_jsonb(v_session));
END;
$$;
