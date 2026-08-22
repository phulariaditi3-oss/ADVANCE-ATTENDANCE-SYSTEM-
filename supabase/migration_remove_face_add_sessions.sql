-- ============================================
-- SSPI Smart QR Attendance System
-- MIGRATION: Remove Face Recognition + Add 2-Session Security
-- ============================================

-- 1. Remove Face Recognition functions and tables
DROP FUNCTION IF EXISTS mark_attendance(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, DOUBLE PRECISION[]);
DROP FUNCTION IF EXISTS mark_attendance(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS register_face(UUID, DOUBLE PRECISION[]);
DROP FUNCTION IF EXISTS face_registration_status(UUID);
DROP FUNCTION IF EXISTS delete_face_profile(UUID);
DROP FUNCTION IF EXISTS face_descriptor_distance(DOUBLE PRECISION[], DOUBLE PRECISION[]);
DROP TABLE IF EXISTS student_face_profiles;

-- 2. Create student_sessions table
CREATE TABLE IF NOT EXISTS student_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  login_time TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  device_info TEXT
);

CREATE INDEX IF NOT EXISTS idx_student_sessions_student ON student_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_session ON student_sessions(session_id);

ALTER TABLE student_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all operations on student_sessions" ON student_sessions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Replace mark_attendance without face descriptor
CREATE OR REPLACE FUNCTION mark_attendance(
  p_session_id UUID,
  p_student_id UUID,
  p_token TEXT,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_accuracy NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_student RECORD;
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
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Student not found.');
  END IF;

  IF v_student.department != v_session.department
     OR v_student.year != v_session.year
     OR v_student.semester != v_session.semester THEN
    RETURN jsonb_build_object('success', false, 'message', 'This session is not for your department/year/semester.');
  END IF;

  -- 6. Calculate Distance (Haversine)
  phi1 := radians(p_lat);
  phi2 := radians(v_college_lat);
  delta_phi := radians(v_college_lat - p_lat);
  delta_lambda := radians(v_college_lng - p_lng);

  a := sin(delta_phi / 2.0) * sin(delta_phi / 2.0) +
       cos(phi1) * cos(phi2) * sin(delta_lambda / 2.0) * sin(delta_lambda / 2.0);

  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  v_distance := R * c;

  -- 7. Check Radius
  IF v_distance > v_max_radius THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are outside the allowed college attendance area (' || round(v_distance, 0) || 'm away).');
  END IF;

  -- 8. Check Duplicate Attendance
  IF EXISTS (SELECT 1 FROM attendance WHERE session_id = p_session_id AND student_id = p_student_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Attendance already marked for this class.');
  END IF;

  -- 9. Insert Attendance
  INSERT INTO attendance (
    session_id, student_id, latitude, longitude, distance_from_college, status
  ) VALUES (
    p_session_id, p_student_id, p_lat, p_lng, v_distance, 'present'
  );

  RETURN jsonb_build_object('success', true, 'message', 'Attendance marked successfully.', 'distance', round(v_distance, 0));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'message', 'Attendance already marked for this class.');
WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', 'Database error: ' || SQLERRM);
END;
$$;

-- 4. Create student_login_check RPC
CREATE OR REPLACE FUNCTION student_login_check(
  p_student_id UUID,
  p_session_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_count INTEGER;
  v_timeout_hours INTEGER := 12;
BEGIN
  -- Mark stale sessions as inactive
  UPDATE student_sessions
  SET is_active = false
  WHERE student_id = p_student_id
    AND is_active = true
    AND last_activity < NOW() - (v_timeout_hours || ' hours')::INTERVAL;

  -- Count currently active sessions (excluding the current one in case of retry)
  SELECT COUNT(*) INTO v_active_count
  FROM student_sessions
  WHERE student_id = p_student_id
    AND is_active = true
    AND session_id != p_session_id;

  IF v_active_count >= 2 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Maximum 2 active sessions reached. Please log out from another device before trying again.');
  END IF;

  -- Insert or update the session
  INSERT INTO student_sessions (student_id, session_id, login_time, last_activity, is_active)
  VALUES (p_student_id, p_session_id, NOW(), NOW(), true)
  ON CONFLICT (session_id) 
  DO UPDATE SET last_activity = NOW(), is_active = true;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Create student_logout RPC
CREATE OR REPLACE FUNCTION student_logout(
  p_session_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE student_sessions
  SET is_active = false, logout_time = NOW()
  WHERE session_id = p_session_id AND is_active = true;

  RETURN jsonb_build_object('success', true);
END;
$$;
