-- ============================================
-- SSPI Smart QR Attendance System
-- Supabase PostgreSQL Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. STAFF TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('ME', 'CE', 'CO', 'EJ')),
  staff_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'hod')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If upgrading an existing DB, run:
-- ALTER TABLE staff ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'hod'));

-- ============================================
-- 2. STUDENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  enrollment_no TEXT NOT NULL UNIQUE,
  roll_no INTEGER NOT NULL,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('ME', 'CE', 'CO', 'EJ')),
  year INTEGER NOT NULL CHECK (year IN (1, 2, 3)),
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6),
  student_mobile TEXT NOT NULL,
  parent_mobile TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (department, year, roll_no)
);

-- ============================================
-- 3. SUBJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL CHECK (department IN ('ME', 'CE', 'CO', 'EJ')),
  year INTEGER NOT NULL CHECK (year IN (1, 2, 3)),
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6)
);

-- ============================================
-- 4. SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  year INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  qr_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'closed')),
  total_present INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent')),
  latitude NUMERIC,
  longitude NUMERIC,
  distance_from_college NUMERIC,
  UNIQUE (session_id, student_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_students_dept_year ON students(department, year);
CREATE INDEX IF NOT EXISTS idx_students_enrollment ON students(enrollment_no);
CREATE INDEX IF NOT EXISTS idx_subjects_dept_year_sem ON subjects(department, year, semester);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher ON sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_dept_year ON sessions(department, year);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(qr_token);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

-- ============================================
-- SEED DATA: SUBJECTS (MSBTE K-Scheme)
-- ============================================

-- =====================
-- MECHANICAL ENGINEERING (ME)
-- =====================

-- ME Year 1 Sem 1
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Basic Mathematics', 'ME-1-1-BM', 'ME', 1, 1),
('Basic Science', 'ME-1-1-BS', 'ME', 1, 1),
('Communication Skills', 'ME-1-1-CS', 'ME', 1, 1),
('Engineering Graphics', 'ME-1-1-EG', 'ME', 1, 1),
('Engineering Workshop Practice', 'ME-1-1-EWP', 'ME', 1, 1),
('Fundamentals of ICT', 'ME-1-1-FICT', 'ME', 1, 1),
('Yoga and Meditation', 'ME-1-1-YM', 'ME', 1, 1) ON CONFLICT (code) DO NOTHING;

-- ME Year 1 Sem 2
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Applied Mathematics', 'ME-1-2-AM', 'ME', 1, 2),
('Applied Science', 'ME-1-2-AS', 'ME', 1, 2),
('Engineering Drawing', 'ME-1-2-ED', 'ME', 1, 2),
('Engineering Mechanics', 'ME-1-2-EM', 'ME', 1, 2),
('Manufacturing Technology', 'ME-1-2-MT', 'ME', 1, 2),
('Professional Communication', 'ME-1-2-PC', 'ME', 1, 2),
('Social and Life Skills', 'ME-1-2-SLS', 'ME', 1, 2) ON CONFLICT (code) DO NOTHING;

-- ME Year 2 Sem 3
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Strength of Materials', 'ME-2-3-SOM', 'ME', 2, 3),
('Fluid Mechanics and Machinery', 'ME-2-3-FMM', 'ME', 2, 3),
('Thermal Engineering', 'ME-2-3-TE', 'ME', 2, 3),
('Production Drawing', 'ME-2-3-PD', 'ME', 2, 3),
('Basic Electrical and Electronics', 'ME-2-3-BEE', 'ME', 2, 3),
('Essence of Indian Constitution', 'ME-2-3-EIC', 'ME', 2, 3),
('Computer Aided Drafting', 'ME-2-3-CAD', 'ME', 2, 3),
('Fundamentals of Python Programming', 'ME-2-3-FPP', 'ME', 2, 3) ON CONFLICT (code) DO NOTHING;

-- ME Year 2 Sem 4
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Environmental Education and Sustainability', 'ME-2-4-EES', 'ME', 2, 4),
('Theory of Machines', 'ME-2-4-TOM', 'ME', 2, 4),
('Metrology and Measurement', 'ME-2-4-MM', 'ME', 2, 4),
('Mechanical Engineering Materials', 'ME-2-4-MEM', 'ME', 2, 4),
('Production Processes', 'ME-2-4-PP', 'ME', 2, 4),
('Entrepreneurship and Startups', 'ME-2-4-ES', 'ME', 2, 4),
('Basics of Mechatronics', 'ME-2-4-BOM', 'ME', 2, 4),
('CNC Programming', 'ME-2-4-CNC', 'ME', 2, 4) ON CONFLICT (code) DO NOTHING;

-- ME Year 3 Sem 5
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Emerging Trends in Mechanical Engineering', 'ME-3-5-ETME', 'ME', 3, 5),
('Power Engineering', 'ME-3-5-PE', 'ME', 3, 5),
('Automobile Engineering', 'ME-3-5-AE', 'ME', 3, 5),
('Seminar and Project Initiation', 'ME-3-5-SPI', 'ME', 3, 5),
('Internship', 'ME-3-5-INT', 'ME', 3, 5) ON CONFLICT (code) DO NOTHING;

-- ME Year 3 Sem 6
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Management', 'ME-3-6-MGT', 'ME', 3, 6),
('Design of Machine Elements', 'ME-3-6-DME', 'ME', 3, 6),
('Industrial Engineering and Quality Control', 'ME-3-6-IEQC', 'ME', 3, 6),
('Industrial Hydraulics and Pneumatics', 'ME-3-6-IHP', 'ME', 3, 6),
('3D Modelling and Additive Manufacturing', 'ME-3-6-3DAM', 'ME', 3, 6),
('Capstone Project', 'ME-3-6-CP', 'ME', 3, 6) ON CONFLICT (code) DO NOTHING;

-- =====================
-- CIVIL ENGINEERING (CE)
-- =====================

-- CE Year 1 Sem 1
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Basic Mathematics', 'CE-1-1-BM', 'CE', 1, 1),
('Basic Science', 'CE-1-1-BS', 'CE', 1, 1),
('Communication Skills', 'CE-1-1-CS', 'CE', 1, 1),
('Engineering Graphics', 'CE-1-1-EG', 'CE', 1, 1),
('Civil Engineering Workshop', 'CE-1-1-CEW', 'CE', 1, 1),
('Fundamentals of ICT', 'CE-1-1-FICT', 'CE', 1, 1),
('Yoga and Meditation', 'CE-1-1-YM', 'CE', 1, 1) ON CONFLICT (code) DO NOTHING;

-- CE Year 1 Sem 2
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Applied Mathematics', 'CE-1-2-AM', 'CE', 1, 2),
('Applied Science', 'CE-1-2-AS', 'CE', 1, 2),
('Engineering Mechanics', 'CE-1-2-EM', 'CE', 1, 2),
('Building Materials and Construction', 'CE-1-2-BMC', 'CE', 1, 2),
('Surveying', 'CE-1-2-SUR', 'CE', 1, 2),
('Professional Communication', 'CE-1-2-PC', 'CE', 1, 2),
('Social and Life Skills', 'CE-1-2-SLS', 'CE', 1, 2) ON CONFLICT (code) DO NOTHING;

-- CE Year 2 Sem 3
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Strength of Materials', 'CE-2-3-SOM', 'CE', 2, 3),
('Advanced Surveying', 'CE-2-3-AS', 'CE', 2, 3),
('Concrete Technology', 'CE-2-3-CT', 'CE', 2, 3),
('Highway Engineering', 'CE-2-3-HE', 'CE', 2, 3),
('Essence of Indian Constitution', 'CE-2-3-EIC', 'CE', 2, 3),
('Building Planning and Drawing with CAD', 'CE-2-3-BPDC', 'CE', 2, 3),
('Construction Management', 'CE-2-3-CM', 'CE', 2, 3) ON CONFLICT (code) DO NOTHING;

-- CE Year 2 Sem 4
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Environmental Education and Sustainability', 'CE-2-4-EES', 'CE', 2, 4),
('Railway Bridge and Tunnel Engineering', 'CE-2-4-RBTE', 'CE', 2, 4),
('Hydraulics', 'CE-2-4-HYD', 'CE', 2, 4),
('Estimating Costing and Valuation', 'CE-2-4-ECV', 'CE', 2, 4),
('Water and Wastewater Engineering', 'CE-2-4-WWE', 'CE', 2, 4),
('Geotechnical Engineering', 'CE-2-4-GE', 'CE', 2, 4) ON CONFLICT (code) DO NOTHING;

-- CE Year 3 Sem 5
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Theory of Structures', 'CE-3-5-TOS', 'CE', 3, 5),
('Water Resource Engineering', 'CE-3-5-WRE', 'CE', 3, 5),
('Emerging Trends in Civil Engineering', 'CE-3-5-ETCE', 'CE', 3, 5),
('Seminar and Project Initiation', 'CE-3-5-SPI', 'CE', 3, 5),
('Internship', 'CE-3-5-INT', 'CE', 3, 5) ON CONFLICT (code) DO NOTHING;

-- CE Year 3 Sem 6
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Management', 'CE-3-6-MGT', 'CE', 3, 6),
('Design of Steel Structures', 'CE-3-6-DSS', 'CE', 3, 6),
('Contract Management', 'CE-3-6-CM', 'CE', 3, 6),
('Advanced Construction Techniques', 'CE-3-6-ACT', 'CE', 3, 6),
('Capstone Project', 'CE-3-6-CP', 'CE', 3, 6) ON CONFLICT (code) DO NOTHING;

-- =====================
-- COMPUTER ENGINEERING (CO)
-- =====================

-- CO Year 1 Sem 1
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Basic Mathematics', 'CO-1-1-BM', 'CO', 1, 1),
('Basic Science', 'CO-1-1-BS', 'CO', 1, 1),
('Communication Skills', 'CO-1-1-CS', 'CO', 1, 1),
('Engineering Graphics', 'CO-1-1-EG', 'CO', 1, 1),
('Engineering Workshop Practice', 'CO-1-1-EWP', 'CO', 1, 1),
('Fundamentals of ICT', 'CO-1-1-FICT', 'CO', 1, 1),
('Yoga and Meditation', 'CO-1-1-YM', 'CO', 1, 1) ON CONFLICT (code) DO NOTHING;

-- CO Year 1 Sem 2
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Applied Mathematics', 'CO-1-2-AM', 'CO', 1, 2),
('Basic Electrical and Electronics', 'CO-1-2-BEE', 'CO', 1, 2),
('Programming in C', 'CO-1-2-PIC', 'CO', 1, 2),
('Professional Communication', 'CO-1-2-PC', 'CO', 1, 2),
('Social and Life Skills', 'CO-1-2-SLS', 'CO', 1, 2),
('Linux Basics', 'CO-1-2-LB', 'CO', 1, 2),
('Web Page Designing', 'CO-1-2-WPD', 'CO', 1, 2) ON CONFLICT (code) DO NOTHING;

-- CO Year 2 Sem 3
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Data Structure Using C', 'CO-2-3-DSC', 'CO', 2, 3),
('Database Management System', 'CO-2-3-DBMS', 'CO', 2, 3),
('Digital Techniques', 'CO-2-3-DT', 'CO', 2, 3),
('Object Oriented Programming using C++', 'CO-2-3-OOP', 'CO', 2, 3),
('Computer Graphics', 'CO-2-3-CG', 'CO', 2, 3),
('Essence of Indian Constitution', 'CO-2-3-EIC', 'CO', 2, 3) ON CONFLICT (code) DO NOTHING;

-- CO Year 2 Sem 4
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Java Programming', 'CO-2-4-JP', 'CO', 2, 4),
('Data Communication and Computer Network', 'CO-2-4-DCCN', 'CO', 2, 4),
('Microprocessor Programming', 'CO-2-4-MP', 'CO', 2, 4),
('Environmental Education and Sustainability', 'CO-2-4-EES', 'CO', 2, 4),
('Python Programming', 'CO-2-4-PP', 'CO', 2, 4),
('UI/UX Design', 'CO-2-4-UIUX', 'CO', 2, 4) ON CONFLICT (code) DO NOTHING;

-- CO Year 3 Sem 5
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Operating System', 'CO-3-5-OS', 'CO', 3, 5),
('Software Engineering', 'CO-3-5-SE', 'CO', 3, 5),
('Advanced Computer Network', 'CO-3-5-ACN', 'CO', 3, 5),
('Cloud Computing', 'CO-3-5-CC', 'CO', 3, 5),
('Data Analytics', 'CO-3-5-DA', 'CO', 3, 5),
('Seminar and Project Initiation', 'CO-3-5-SPI', 'CO', 3, 5),
('Internship', 'CO-3-5-INT', 'CO', 3, 5),
('Entrepreneurship Development and Startups', 'CO-3-5-EDS', 'CO', 3, 5) ON CONFLICT (code) DO NOTHING;

-- CO Year 3 Sem 6
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Management', 'CO-3-6-MGT', 'CO', 3, 6),
('Emerging Trends in CO and IT', 'CO-3-6-ETCI', 'CO', 3, 6),
('Network and Information Security', 'CO-3-6-NIS', 'CO', 3, 6),
('Artificial Intelligence', 'CO-3-6-AI', 'CO', 3, 6),
('Web Based Application Development using PHP', 'CO-3-6-WADP', 'CO', 3, 6),
('Capstone Project', 'CO-3-6-CP', 'CO', 3, 6) ON CONFLICT (code) DO NOTHING;

-- =====================
-- ELECTRONICS & TELECOMMUNICATION (EJ)
-- =====================

-- EJ Year 1 Sem 1
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Basic Mathematics', 'EJ-1-1-BM', 'EJ', 1, 1),
('Basic Science', 'EJ-1-1-BS', 'EJ', 1, 1),
('Communication Skills', 'EJ-1-1-CS', 'EJ', 1, 1),
('Engineering Graphics', 'EJ-1-1-EG', 'EJ', 1, 1),
('Engineering Workshop Practice', 'EJ-1-1-EWP', 'EJ', 1, 1),
('Fundamentals of ICT', 'EJ-1-1-FICT', 'EJ', 1, 1),
('Yoga and Meditation', 'EJ-1-1-YM', 'EJ', 1, 1) ON CONFLICT (code) DO NOTHING;

-- EJ Year 1 Sem 2
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Applied Mathematics', 'EJ-1-2-AM', 'EJ', 1, 2),
('Basic Electronics', 'EJ-1-2-BE', 'EJ', 1, 2),
('Elements of Electrical Engineering', 'EJ-1-2-EEE', 'EJ', 1, 2),
('Programming in C Language', 'EJ-1-2-PCL', 'EJ', 1, 2),
('Professional Communication', 'EJ-1-2-PC', 'EJ', 1, 2),
('Social and Life Skills', 'EJ-1-2-SLS', 'EJ', 1, 2),
('Electronic Materials and Components', 'EJ-1-2-EMC', 'EJ', 1, 2) ON CONFLICT (code) DO NOTHING;

-- EJ Year 2 Sem 3
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Digital Techniques', 'EJ-2-3-DT', 'EJ', 2, 3),
('Analog Electronics', 'EJ-2-3-AE', 'EJ', 2, 3),
('Circuits and Networks', 'EJ-2-3-CN', 'EJ', 2, 3),
('Principles of Electronic Communication', 'EJ-2-3-PEC', 'EJ', 2, 3),
('Essence of Indian Constitution', 'EJ-2-3-EIC', 'EJ', 2, 3),
('Basic Python Programming', 'EJ-2-3-BPP', 'EJ', 2, 3),
('Electronic Measurements and Instrumentation', 'EJ-2-3-EMI', 'EJ', 2, 3) ON CONFLICT (code) DO NOTHING;

-- EJ Year 2 Sem 4
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Environmental Education and Sustainability', 'EJ-2-4-EES', 'EJ', 2, 4),
('Digital Communication Systems', 'EJ-2-4-DCS', 'EJ', 2, 4),
('Consumer Electronic Systems', 'EJ-2-4-CES', 'EJ', 2, 4),
('Microcontroller and Applications', 'EJ-2-4-MA', 'EJ', 2, 4),
('Basic Power Electronics', 'EJ-2-4-BPE', 'EJ', 2, 4),
('Electronic Equipment Maintenance', 'EJ-2-4-EEM', 'EJ', 2, 4) ON CONFLICT (code) DO NOTHING;

-- EJ Year 3 Sem 5
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Emerging Trends in EJ', 'EJ-3-5-ETEJ', 'EJ', 3, 5),
('Microwave and Radar Engineering', 'EJ-3-5-MRE', 'EJ', 3, 5),
('Mobile Communication', 'EJ-3-5-MC', 'EJ', 3, 5),
('Seminar and Project Initiation', 'EJ-3-5-SPI', 'EJ', 3, 5),
('Internship', 'EJ-3-5-INT', 'EJ', 3, 5) ON CONFLICT (code) DO NOTHING;

-- EJ Year 3 Sem 6
INSERT INTO subjects (name, code, department, year, semester) VALUES
('Management', 'EJ-3-6-MGT', 'EJ', 3, 6),
('Optical Network and Satellite Communication', 'EJ-3-6-ONSC', 'EJ', 3, 6),
('Capstone Project', 'EJ-3-6-CP', 'EJ', 3, 6) ON CONFLICT (code) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anonymous users
-- (We handle auth at the application level since we're using custom auth)
DO $$ BEGIN
  CREATE POLICY "Allow all operations on staff" ON staff FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Allow all operations on students" ON students FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Allow all operations on subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Allow all operations on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Allow all operations on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 6. SECURE ATTENDANCE RPC FUNCTION
-- ============================================
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
  v_distance NUMERIC;
  v_college_lat NUMERIC := 19.2557824;
  v_college_lng NUMERIC := 76.7822683;
  v_max_radius NUMERIC := 150;
  v_max_accuracy NUMERIC := 100;
  R NUMERIC := 6371000; -- Earth radius in meters
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

  -- 5. Calculate Distance (Haversine)
  phi1 := radians(p_lat);
  phi2 := radians(v_college_lat);
  delta_phi := radians(v_college_lat - p_lat);
  delta_lambda := radians(v_college_lng - p_lng);

  a := sin(delta_phi / 2.0) * sin(delta_phi / 2.0) +
       cos(phi1) * cos(phi2) * sin(delta_lambda / 2.0) * sin(delta_lambda / 2.0);
  
  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
  v_distance := R * c;

  -- 6. Check Radius
  IF v_distance > v_max_radius THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are outside the allowed college attendance area (' || round(v_distance, 0) || 'm away).');
  END IF;

  -- 7. Check Duplicate Attendance
  IF EXISTS (SELECT 1 FROM attendance WHERE session_id = p_session_id AND student_id = p_student_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Attendance has already been marked for this session.');
  END IF;

  -- 8. Insert Attendance
  INSERT INTO attendance (
    session_id,
    student_id,
    latitude,
    longitude,
    distance_from_college,
    status
  ) VALUES (
    p_session_id,
    p_student_id,
    p_lat,
    p_lng,
    v_distance,
    'present'
  );

  RETURN jsonb_build_object('success', true, 'message', 'Attendance marked successfully.', 'distance', round(v_distance, 0));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'message', 'Attendance has already been marked for this session.');
WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', 'Database error: ' || SQLERRM);
END;
$$;
