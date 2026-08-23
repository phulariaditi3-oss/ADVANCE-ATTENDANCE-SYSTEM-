-- ============================================
-- SSPI Smart QR Attendance System
-- MIGRATION: Strict 10-Meter QR-Device GPS Verification
-- Safe to run on existing database. Replaces mark_attendance and
-- create_attendance_session to enforce exactly 10 meters.
--
-- Run AFTER migration_teacher_gps_radius.sql.
--
-- WHAT THIS CHANGES:
--  • MAX_ATTENDANCE_DISTANCE_METERS is now 10 (was 20).
--  • The radius is hardcoded server-side — the frontend cannot override it.
--  • create_attendance_session no longer accepts p_radius_meters; it always
--    stores 10 in gps_radius_meters.
--  • mark_attendance always reads gps_radius_meters from the session row but
--    caps it at 10 — so even old sessions with gps_radius_meters=20 will be
--    capped to 10 going forward.
--  • Error messages are updated to explicitly say "10 meters".
-- ============================================

-- Centralized constant (stored in the session row, always <= 10)
-- Existing sessions that already have gps_radius_meters set are left untouched
-- by this migration (we only cap at verification time — see mark_attendance below).

-- ============================================
-- 1. Replace create_attendance_session
--    GPS location still required; radius is now always 10 (server-enforced).
-- ============================================
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
  -- p_radius_meters is accepted for backward compatibility but IGNORED;
  -- the server always uses MAX_ATTENDANCE_DISTANCE_METERS = 10.
  p_radius_meters   NUMERIC DEFAULT 10
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allowed   BOOLEAN;
  v_session   sessions;
  -- Central constant — change only here to update the entire system.
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

  INSERT INTO sessions (
    teacher_id, department, year, semester, subject_id, subject_name,
    qr_token, expires_at, status, teacher_lat, teacher_lng,
    teacher_gps_accuracy, gps_radius_meters
  ) VALUES (
    p_teacher_id, p_department, p_year, p_semester, p_subject_id, p_subject_name,
    p_qr_token, p_expires_at, 'active', p_teacher_lat, p_teacher_lng,
    p_teacher_accuracy,
    -- Always store exactly 10 regardless of what the client sends
    v_max_distance_meters
  )
  RETURNING * INTO v_session;

  RETURN jsonb_build_object('success', true, 'session', to_jsonb(v_session));
END;
$$;

-- ============================================
-- 2. Replace mark_attendance
--    Distance must be <= 10 m. Even sessions created before this migration
--    are capped: LEAST(COALESCE(session.gps_radius_meters, 10), 10).
-- ============================================
CREATE OR REPLACE FUNCTION mark_attendance(
  p_session_id     UUID,
  p_student_id     UUID,
  p_token          TEXT,
  p_lat            NUMERIC,
  p_lng            NUMERIC,
  p_accuracy       NUMERIC,
  p_face_descriptor DOUBLE PRECISION[] DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session              RECORD;
  v_student              RECORD;
  v_stored_descriptor    DOUBLE PRECISION[];
  v_face_distance        DOUBLE PRECISION;
  v_face_threshold       DOUBLE PRECISION := 0.5;
  v_distance             NUMERIC;
  -- MAX_ATTENDANCE_DISTANCE_METERS = 10
  -- Used as the absolute server-side cap — never read from the client.
  v_max_distance_meters  NUMERIC := 10;
  v_effective_radius     NUMERIC;
  v_max_accuracy         NUMERIC := 100;
  R                      NUMERIC := 6371000;   -- Earth radius in metres
  phi1                   NUMERIC;
  phi2                   NUMERIC;
  delta_phi              NUMERIC;
  delta_lambda           NUMERIC;
  a                      NUMERIC;
  c                      NUMERIC;
BEGIN
  -- 1. Validate GPS accuracy
  IF p_accuracy > v_max_accuracy THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '📍 GPS accuracy is too low (' || round(p_accuracy, 1) || 'm). '
              || 'Please enable precise location and try again.'
    );
  END IF;

  -- 2. Verify session exists and is active
  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid session.');
  END IF;

  IF v_session.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This attendance session is no longer active.');
  END IF;

  -- 3. Verify token
  IF v_session.qr_token != p_token THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid attendance token.');
  END IF;

  -- 4. Verify expiration
  IF NOW() > v_session.expires_at THEN
    RETURN jsonb_build_object('success', false, 'message', 'This attendance token has expired.');
  END IF;

  -- 5. Verify student belongs to this session's department/year/semester
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Student not found.');
  END IF;

  IF v_student.department != v_session.department
     OR v_student.year     != v_session.year
     OR v_student.semester != v_session.semester THEN
    RETURN jsonb_build_object('success', false,
      'message', 'This session is not for your department/year/semester.');
  END IF;

  -- 6. Face verification (required)
  SELECT descriptor INTO v_stored_descriptor
  FROM student_face_profiles WHERE student_id = p_student_id;

  IF v_stored_descriptor IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'message', 'Face not registered. Please register your face first.');
  END IF;

  IF p_face_descriptor IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'message', 'Face verification is required to mark attendance.');
  END IF;

  v_face_distance := face_descriptor_distance(v_stored_descriptor, p_face_descriptor);

  IF v_face_distance IS NULL OR v_face_distance > v_face_threshold THEN
    RETURN jsonb_build_object('success', false,
      'message', 'Face verification failed. Attendance was not marked.');
  END IF;

  -- 7. Teacher location must be recorded on the session
  IF v_session.teacher_lat IS NULL OR v_session.teacher_lng IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'message', 'This session has no teacher location on record. '
              || 'Ask your teacher to start a new session.');
  END IF;

  -- Effective radius: always cap at 10 m regardless of what the session stores.
  -- This ensures old sessions (gps_radius_meters = 20) are also enforced at 10 m.
  v_effective_radius := LEAST(COALESCE(v_session.gps_radius_meters, v_max_distance_meters), v_max_distance_meters);

  -- 8. Haversine distance between STUDENT and QR-generating TEACHER device location
  phi1         := radians(p_lat);
  phi2         := radians(v_session.teacher_lat);
  delta_phi    := radians(v_session.teacher_lat - p_lat);
  delta_lambda := radians(v_session.teacher_lng  - p_lng);

  a := sin(delta_phi / 2.0)    * sin(delta_phi / 2.0)
     + cos(phi1) * cos(phi2)   * sin(delta_lambda / 2.0) * sin(delta_lambda / 2.0);
  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  v_distance := R * c;

  -- 9. Enforce MAX_ATTENDANCE_DISTANCE_METERS = 10
  IF v_distance > v_effective_radius THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ You are too far from the attendance QR device ('
              || round(v_distance, 0)
              || 'm away). You must be within '
              || round(v_effective_radius, 0)::text
              || ' meters.'
    );
  END IF;

  -- 10. Duplicate check
  IF EXISTS (
    SELECT 1 FROM attendance
    WHERE session_id = p_session_id AND student_id = p_student_id
  ) THEN
    RETURN jsonb_build_object('success', false,
      'message', 'Attendance has already been marked for this session.');
  END IF;

  -- 11. Insert attendance
  INSERT INTO attendance (
    session_id, student_id, latitude, longitude, distance_from_college, status
  ) VALUES (
    p_session_id, p_student_id, p_lat, p_lng, v_distance, 'present'
  );

  RETURN jsonb_build_object(
    'success',       true,
    'message',       '✅ Location verified. Attendance marked successfully.',
    'distance',      round(v_distance, 1),
    'face_distance', round(v_face_distance::numeric, 4)
  );

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false,
    'message', 'Attendance has already been marked for this session.');
WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false,
    'message', 'Database error: ' || SQLERRM);
END;
$$;

-- ============================================
-- DONE.
-- All future QR/token attendance sessions will use MAX_ATTENDANCE_DISTANCE_METERS = 10.
-- create_attendance_session always stores 10 in gps_radius_meters.
-- mark_attendance always caps at 10 even for older sessions.
-- ============================================
