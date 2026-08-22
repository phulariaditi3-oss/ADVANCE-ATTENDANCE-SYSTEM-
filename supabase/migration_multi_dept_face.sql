-- ============================================
-- SSPI Smart QR Attendance System
-- MIGRATION: Multi-Department Staff Assignment + Face Recognition
-- Safe to run on an existing database. Does not delete any data.
-- Run this whole file once in the Supabase SQL Editor.
-- ============================================

-- ============================================
-- 1. STAFF_DEPARTMENTS (teacher -> which departments they may teach)
-- ============================================
CREATE TABLE IF NOT EXISTS staff_departments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  department_code TEXT NOT NULL CHECK (department_code IN ('ME', 'CE', 'CO', 'EJ')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, department_code)
);

CREATE INDEX IF NOT EXISTS idx_staff_departments_staff ON staff_departments(staff_id);

ALTER TABLE staff_departments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all operations on staff_departments" ON staff_departments FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: every existing staff member starts out assigned to teach their
-- current home department, so nothing they can already do today changes.
INSERT INTO staff_departments (staff_id, department_code)
SELECT id, department FROM staff
ON CONFLICT (staff_id, department_code) DO NOTHING;

-- ============================================
-- 2. STUDENT_FACE_PROFILES (biometric embedding storage)
-- ============================================
-- descriptor = 128-length face-recognition embedding (face-api.js), stored as
-- float8[] server-side only. It is NEVER selected back to the frontend by any
-- RPC below - only match/no-match + distance are returned.
CREATE TABLE IF NOT EXISTS student_face_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  descriptor DOUBLE PRECISION[] NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_profiles_student ON student_face_profiles(student_id);

ALTER TABLE student_face_profiles ENABLE ROW LEVEL SECURITY;

-- No direct table access policy for descriptor reads from the client - all
-- reads/writes to this table happen through the SECURITY DEFINER RPCs below,
-- which never return the raw descriptor. We still add a permissive policy
-- (consistent with the rest of this app's custom-auth model) so admin tooling
-- and the RPCs themselves can operate, but the app must not query this table
-- directly with select('descriptor').
DO $$ BEGIN
  CREATE POLICY "Allow all operations on student_face_profiles" ON student_face_profiles FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 3. HELPER: Euclidean distance between two equal-length float arrays
-- ============================================
CREATE OR REPLACE FUNCTION face_descriptor_distance(a DOUBLE PRECISION[], b DOUBLE PRECISION[])
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  i INT;
  total DOUBLE PRECISION := 0;
BEGIN
  IF a IS NULL OR b IS NULL OR array_length(a, 1) IS DISTINCT FROM array_length(b, 1) THEN
    RETURN NULL;
  END IF;
  FOR i IN 1..array_length(a, 1) LOOP
    total := total + (a[i] - b[i]) * (a[i] - b[i]);
  END LOOP;
  RETURN sqrt(total);
END;
$$;

-- ============================================
-- 4. RPC: register_face
-- Restricted to the authenticated student's own account at the application
-- layer (student_id comes from the logged-in session, same trust model the
-- app already uses for mark_attendance's p_student_id).
-- ============================================
CREATE OR REPLACE FUNCTION register_face(
  p_student_id UUID,
  p_descriptor DOUBLE PRECISION[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_descriptor IS NULL OR array_length(p_descriptor, 1) <> 128 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid face data captured. Please try again.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Student not found.');
  END IF;

  INSERT INTO student_face_profiles (student_id, descriptor, registered_at, updated_at)
  VALUES (p_student_id, p_descriptor, NOW(), NOW())
  ON CONFLICT (student_id)
  DO UPDATE SET descriptor = EXCLUDED.descriptor, updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'message', 'Face registered successfully.');
END;
$$;

-- ============================================
-- 5. RPC: face_registration_status
-- ============================================
CREATE OR REPLACE FUNCTION face_registration_status(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_registered BOOLEAN;
  v_updated_at TIMESTAMPTZ;
BEGIN
  SELECT true, updated_at INTO v_registered, v_updated_at
  FROM student_face_profiles WHERE student_id = p_student_id;

  RETURN jsonb_build_object(
    'registered', COALESCE(v_registered, false),
    'updated_at', v_updated_at
  );
END;
$$;

-- ============================================
-- 6. RPC: delete_face_profile (student can re-register / admin can reset)
-- ============================================
CREATE OR REPLACE FUNCTION delete_face_profile(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM student_face_profiles WHERE student_id = p_student_id;
  RETURN jsonb_build_object('success', true, 'message', 'Face profile removed.');
END;
$$;

-- ============================================
-- 7. RPC: create_attendance_session
-- Server-side enforcement that a teacher is actually assigned to the
-- department they are trying to generate a QR/token session for. This makes
-- the restriction real (not just a hidden dropdown) per the "never trust
-- only frontend filtering" requirement.
-- ============================================
CREATE OR REPLACE FUNCTION create_attendance_session(
  p_teacher_id UUID,
  p_department TEXT,
  p_year INTEGER,
  p_semester INTEGER,
  p_subject_id UUID,
  p_subject_name TEXT,
  p_qr_token TEXT,
  p_expires_at TIMESTAMPTZ
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

  INSERT INTO sessions (
    teacher_id, department, year, semester, subject_id, subject_name,
    qr_token, expires_at, status
  ) VALUES (
    p_teacher_id, p_department, p_year, p_semester, p_subject_id, p_subject_name,
    p_qr_token, p_expires_at, 'active'
  )
  RETURNING * INTO v_session;

  RETURN jsonb_build_object('success', true, 'session', to_jsonb(v_session));
END;
$$;

-- ============================================
-- 8. UPDATE: mark_attendance now also validates the student's own class
--    against the session AND requires a matching face descriptor.
--    p_face_descriptor is optional (kept nullable) so the function does not
--    break if ever called without it, but the app always supplies it.
-- ============================================
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
  v_college_lat NUMERIC := 19.2557824;
  v_college_lng NUMERIC := 76.7822683;
  v_max_radius NUMERIC := 150;
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
  --    (server-side re-check, independent of anything the client sent).
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

  -- 7. Calculate Distance (Haversine)
  phi1 := radians(p_lat);
  phi2 := radians(v_college_lat);
  delta_phi := radians(v_college_lat - p_lat);
  delta_lambda := radians(v_college_lng - p_lng);

  a := sin(delta_phi / 2.0) * sin(delta_phi / 2.0) +
       cos(phi1) * cos(phi2) * sin(delta_lambda / 2.0) * sin(delta_lambda / 2.0);

  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  v_distance := R * c;

  -- 8. Check Radius
  IF v_distance > v_max_radius THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are outside the allowed college attendance area (' || round(v_distance, 0) || 'm away).');
  END IF;

  -- 9. Check Duplicate Attendance
  IF EXISTS (SELECT 1 FROM attendance WHERE session_id = p_session_id AND student_id = p_student_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Attendance has already been marked for this session.');
  END IF;

  -- 10. Insert Attendance
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
-- DONE. Nothing above deletes existing rows. Existing staff each keep the
-- ability to teach (at least) their current department; use the Admin ->
-- Manage Staff screen to grant additional departments.
-- ============================================
