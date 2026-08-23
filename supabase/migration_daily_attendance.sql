-- ============================================
-- SSPI Smart QR Attendance System
-- MIGRATION: Daily College Attendance (Morning / Afternoon)
-- Safe to run on an existing database. Does not modify any existing tables.
-- Run AFTER schema.sql, migration_multi_dept_face.sql, and migration_teacher_gps_radius.sql.
--
-- WHAT THIS ADDS:
-- A completely separate daily_attendance table that records each student's
-- presence for the morning and afternoon sessions of every calendar day.
-- This is independent of QR/token subject attendance.
-- ============================================

-- ============================================
-- 1. DAILY_ATTENDANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS daily_attendance (
  id            UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id    UUID         NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id    UUID         NOT NULL REFERENCES staff(id)    ON DELETE RESTRICT,
  date          DATE         NOT NULL,
  session_type  TEXT         NOT NULL CHECK (session_type IN ('morning', 'afternoon')),
  status        TEXT         NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent')),
  marked_at     TIMESTAMPTZ  DEFAULT NOW(),
  notes         TEXT,

  -- Core uniqueness: one record per student, per calendar day, per session
  UNIQUE (student_id, date, session_type)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_daily_att_student        ON daily_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_daily_att_date           ON daily_attendance(date);
CREATE INDEX IF NOT EXISTS idx_daily_att_teacher        ON daily_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_daily_att_student_date   ON daily_attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_att_dept_date      ON daily_attendance(date, session_type);

-- RLS
ALTER TABLE daily_attendance ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all operations on daily_attendance"
    ON daily_attendance FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 2. RPC: save_daily_attendance
-- Saves an entire morning or afternoon attendance list for a given class.
-- p_records is a JSONB array:
--   [{ "student_id": "<uuid>", "status": "present"|"absent" }, ...]
-- Returns { success, saved, updated, message }
-- ============================================
CREATE OR REPLACE FUNCTION save_daily_attendance(
  p_teacher_id   UUID,
  p_date         DATE,
  p_session_type TEXT,      -- 'morning' or 'afternoon'
  p_records      JSONB      -- [{ "student_id": "...", "status": "present|absent" }]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec         JSONB;
  v_student_id  UUID;
  v_status      TEXT;
  v_saved       INT := 0;
  v_updated     INT := 0;
BEGIN
  -- Basic validation
  IF p_session_type NOT IN ('morning', 'afternoon') THEN
    RETURN jsonb_build_object('success', false, 'message', 'session_type must be morning or afternoon.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE id = p_teacher_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Staff account not found or inactive.');
  END IF;

  IF p_records IS NULL OR jsonb_array_length(p_records) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No attendance records provided.');
  END IF;

  -- Upsert each record
  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records) LOOP
    v_student_id := (v_rec->>'student_id')::UUID;
    v_status     := v_rec->>'status';

    IF v_status NOT IN ('present', 'absent') THEN
      v_status := 'absent';
    END IF;

    INSERT INTO daily_attendance (student_id, teacher_id, date, session_type, status, marked_at)
    VALUES (v_student_id, p_teacher_id, p_date, p_session_type, v_status, NOW())
    ON CONFLICT (student_id, date, session_type)
    DO UPDATE SET
      status     = EXCLUDED.status,
      teacher_id = EXCLUDED.teacher_id,
      marked_at  = NOW();

    IF xmax::text::bigint > 0 THEN  -- row was updated
      v_updated := v_updated + 1;
    ELSE
      v_saved := v_saved + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'saved',   v_saved,
    'updated', v_updated,
    'message', initcap(p_session_type) || ' attendance saved successfully.'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', 'Database error: ' || SQLERRM);
END;
$$;

-- ============================================
-- 3. RPC: get_daily_attendance_status
-- Returns a summary of which classes have taken morning/afternoon attendance
-- for a given date.  Useful for the "Today's attendance overview" panel.
-- Returns rows: { department, year, session_type, student_count, marked_count }
-- ============================================
CREATE OR REPLACE FUNCTION get_daily_attendance_status(p_date DATE)
RETURNS TABLE(
  department    TEXT,
  year          INTEGER,
  session_type  TEXT,
  student_count BIGINT,
  marked_count  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    s.department,
    s.year,
    da.session_type,
    COUNT(DISTINCT s.id)             AS student_count,
    COUNT(DISTINCT da.student_id)    AS marked_count
  FROM students s
  LEFT JOIN daily_attendance da
    ON da.student_id = s.id
   AND da.date = p_date
  WHERE s.is_active = true
  GROUP BY s.department, s.year, da.session_type
  ORDER BY s.department, s.year, da.session_type;
$$;

-- ============================================
-- DONE.
-- ============================================
