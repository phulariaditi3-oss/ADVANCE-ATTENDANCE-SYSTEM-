-- ============================================
-- SSPI Smart QR Attendance System
-- MIGRATION: Teacher-location-based GPS radius
-- Safe to run on an existing database. Does not delete any data.
-- Run this AFTER schema.sql and migration_multi_dept_face.sql.
--
-- WHAT THIS CHANGES:
-- Previously every session was checked against one fixed hardcoded
-- college lat/lng with a 150m radius. From now on, each session stores
-- the TEACHER's own device GPS location at the moment they hit
-- "Generate QR", and students must be within `gps_radius_meters`
-- (default 20m) of THAT exact point to be marked present. Every
-- session can have its own location — e.g. a class held in a
-- different lab/room still works correctly.
-- ============================================

-- 1. Add columns to store the teacher's location + allowed radius per session
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS teacher_lat NUMERIC;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS teacher_lng NUMERIC;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS teacher_gps_accuracy NUMERIC;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS gps_radius_meters NUMERIC DEFAULT 20;

-- 2. Replace create_attendance_session to also capture + store the
--    teacher's GPS location. Location is now REQUIRED to start a session.
CREATE OR REPLACE FUNCTION create_attendance_session(
  p_teacher_id UUID,
  p_department TEXT,
  p_year INTEGER,
  p_semester INTEGER,
  p_subject_id UUID,
  p_subject_name TEXT,
  p_qr_token TEXT,
  p_expires_at TIMESTAMPTZ,
  p_teacher_lat NUMERIC,
  p_teacher_lng NUMERIC,
  p_teacher_accuracy NUMERIC DEFAULT NULL,
  p_radius_meters NUMERIC DEFAULT 20
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allowed BOOLEAN;
  v_session sessions;
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
    p_teacher_accuracy, COALESCE(p_radius_meters, 20)
  )
  RETURNING * INTO v_session;

  RETURN jsonb_build_object('success', true, 'session', to_jsonb(v_session));
END;
$$;

-- 3. Replace mark_attendance to check distance against the session's OWN
--    stored teacher location + radius, instead of one fixed college point.
CREATE OR REPLACE FUNCTION mark_attendance(
  p_session_id UUID,
  p_student_id UUID,
  p_token TEXT,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_accuracy NUMERIC,
  p_face_descriptor DOUBLE PRECISION[] DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_student RECORD;
  v_stored_descriptor DOUBLE PRECISION[];
  v_face_distance DOUBLE PRECISION;
  v_face_threshold DOUBLE PRECISION := 0.5;
  v_distance NUMERIC;
  v_max_radius NUMERIC;
  v_max_accuracy NUMERIC := 100;
  R NUMERIC := 6371000;
  phi1 NUMERIC;
  phi2 NUMERIC;
  delta_phi NUMERIC;
  delta_lambda NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  -- 1. Validate GPS Accuracy
  IF p_accuracy > v_max_accuracy THEN
    RETURN jsonb_build_object('success', false, 'message', 'Your GPS accuracy is too low (' || round(p_accuracy, 1) || 'm). Must be <= ' || v_max_accuracy || 'm. Please enable Location/GPS and try again.');
  END IF;

  -- 2. Verify Session exists and is active
  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid session.');
  END IF;

  IF v_session.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This attendance session is no longer active.');
  END IF;

  -- 3. Verify Token
  IF v_session.qr_token != p_token THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid attendance token.');
  END IF;

  -- 4. Verify Expiration
  IF NOW() > v_session.expires_at THEN
    RETURN jsonb_build_object('success', false, 'message', 'This attendance token has expired.');
  END IF;

  -- 5. Verify the student belongs to this exact department/year/semester
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Student not found.');
  END IF;

  IF v_student.department != v_session.department
     OR v_student.year != v_session.year
     OR v_student.semester != v_session.semester THEN
    RETURN jsonb_build_object('success', false, 'message', 'This session is not for your department/year/semester.');
  END IF;

  -- 6. Face verification (required)
  SELECT descriptor INTO v_stored_descriptor
  FROM student_face_profiles WHERE student_id = p_student_id;

  IF v_stored_descriptor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Face not registered. Please register your face first.');
  END IF;

  IF p_face_descriptor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Face verification is required to mark attendance.');
  END IF;

  v_face_distance := face_descriptor_distance(v_stored_descriptor, p_face_descriptor);

  IF v_face_distance IS NULL OR v_face_distance > v_face_threshold THEN
    RETURN jsonb_build_object('success', false, 'message', 'Face verification failed. Attendance was not marked.');
  END IF;

  -- 7. Session must have a teacher location recorded (sessions created
  --    before this migration won't have one — reject those safely).
  IF v_session.teacher_lat IS NULL OR v_session.teacher_lng IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'This session has no teacher location on record. Ask your teacher to start a new session.');
  END IF;

  v_max_radius := COALESCE(v_session.gps_radius_meters, 20);

  -- 8. Calculate Distance (Haversine) between STUDENT and TEACHER's
  --    location at the moment they generated the QR — not a fixed point.
  phi1 := radians(p_lat);
  phi2 := radians(v_session.teacher_lat);
  delta_phi := radians(v_session.teacher_lat - p_lat);
  delta_lambda := radians(v_session.teacher_lng - p_lng);

  a := sin(delta_phi / 2.0) * sin(delta_phi / 2.0) +
       cos(phi1) * cos(phi2) * sin(delta_lambda / 2.0) * sin(delta_lambda / 2.0);

  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  v_distance := R * c;

  -- 9. Check Radius (default 20m, configurable per session)
  IF v_distance > v_max_radius THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are too far from your teacher (' || round(v_distance, 0) || 'm away). You must be within ' || v_max_radius || 'm.');
  END IF;

  -- 10. Check Duplicate Attendance
  IF EXISTS (SELECT 1 FROM attendance WHERE session_id = p_session_id AND student_id = p_student_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Attendance has already been marked for this session.');
  END IF;

  -- 11. Insert Attendance
  INSERT INTO attendance (
    session_id, student_id, latitude, longitude, distance_from_college, status
  ) VALUES (
    p_session_id, p_student_id, p_lat, p_lng, v_distance, 'present'
  );

  RETURN jsonb_build_object('success', true, 'message', 'Attendance marked successfully.', 'distance', round(v_distance, 0), 'face_distance', round(v_face_distance::numeric, 4));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'message', 'Attendance has already been marked for this session.');
WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', 'Database error: ' || SQLERRM);
END;
$$;

-- ============================================
-- DONE. Existing (already-closed) sessions are untouched. Any session
-- created going forward will require the teacher's GPS location and will
-- check students against it with a 20m radius by default.
-- ============================================
