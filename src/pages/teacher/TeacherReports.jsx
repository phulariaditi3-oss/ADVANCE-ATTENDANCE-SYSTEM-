import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { YEARS, YEAR_SEMESTERS, getDeptLabel } from '../../lib/constants';
import { generateExcelReport, generateCSVReport } from '../../lib/reports';
import { useToast } from '../../contexts/ToastContext';
import { FileDown, GraduationCap, Filter } from 'lucide-react';

export default function TeacherReports() {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('semester');

  // Departments this teacher is allowed to pull reports for — same set
  // they're allowed to take attendance for.
  const teachingDepartments = useMemo(
    () => (user?.teachingDepartments?.length ? user.teachingDepartments : [user?.department].filter(Boolean)),
    [user]
  );

  // Filters
  const [department, setDepartment] = useState(user?.department || teachingDepartments[0] || '');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Pool
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    if (department && year && semester) {
      fetchClassData();
    } else {
      setStudents([]);
      setSubjects([]);
    }
  }, [department, year, semester]);

  const fetchClassData = async () => {
    try {
      const [{ data: studentList }, { data: subjectList }] = await Promise.all([
        supabase
          .from('students')
          .select('id, name, roll_no, enrollment_no')
          .eq('department', department)
          .eq('year', parseInt(year))
          .eq('semester', parseInt(semester))
          .order('roll_no'),
        supabase
          .from('subjects')
          .select('id, name, code')
          .eq('department', department)
          .eq('year', parseInt(year))
          .eq('semester', parseInt(semester))
      ]);

      setStudents(studentList || []);
      setSubjects(subjectList || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = async (format) => {
    if (!department) {
      toast.warning('Please select a Department.');
      return;
    }
    if (!year || !semester) {
      toast.warning('Please select Year and Semester.');
      return;
    }
    if (students.length === 0) {
      toast.warning('No students in selected class.');
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('sessions')
        .select('id, created_at, subject_name')
        .eq('department', department)
        .eq('year', parseInt(year))
        .eq('semester', parseInt(semester));

      if (subject) {
        query = query.eq('subject_id', subject);
      }

      // Time-based filtering
      if (reportType === 'daily') {
        query = query.gte('created_at', `${selectedDate}T00:00:00.000Z`).lte('created_at', `${selectedDate}T23:59:59.999Z`);
      } else if (reportType === 'weekly') {
        const d = new Date(selectedDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(d.setDate(diff)).toISOString().split('T')[0];
        const end = new Date(d.setDate(diff + 6)).toISOString().split('T')[0];
        query = query.gte('created_at', `${start}T00:00:00.000Z`).lte('created_at', `${end}T23:59:59.999Z`);
      } else if (reportType === 'monthly') {
        const parts = selectedDate.split('-');
        const lastDay = new Date(parts[0], parts[1], 0).getDate();
        query = query
          .gte('created_at', `${parts[0]}-${parts[1]}-01T00:00:00.000Z`)
          .lte('created_at', `${parts[0]}-${parts[1]}-${lastDay}T23:59:59.999Z`);
      }

      const { data: sessions, error: sessionErr } = await query;
      if (sessionErr) throw sessionErr;

      if (!sessions || sessions.length === 0) {
        toast.warning('No sessions found for selected filters.');
        setLoading(false);
        return;
      }

      const sessionIds = sessions.map(s => s.id);
      const { data: attendance, error: attErr } = await supabase
        .from('attendance')
        .select('session_id, student_id, status')
        .in('session_id', sessionIds)
        .eq('status', 'present');

      if (attErr) throw attErr;

      const attendanceMap = {};
      attendance.forEach(a => {
        attendanceMap[`${a.session_id}_${a.student_id}`] = true;
      });

      const selectedSubjObj = subjects.find(s => s.id === subject);
      const subjectLabel = selectedSubjObj ? selectedSubjObj.name : 'All Subjects';

      const config = {
        title: `${reportType.toUpperCase()} ATTENDANCE REPORT`,
        department,
        year,
        semester,
        subject: subjectLabel,
        students,
        sessions,
        attendanceMap,
      };

      if (format === 'excel') {
        await generateExcelReport(config);
        toast.success('Excel downloaded!');
      } else {
        generateCSVReport(config);
        toast.success('CSV downloaded!');
      }
    } catch (err) {
      toast.error('Download failed.');
    } finally {
      setLoading(false);
    }
  };

  const availableSemesters = year ? YEAR_SEMESTERS[parseInt(year)] || [] : [];

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Departmental Reports</h1>
        <p className="text-surface-500 mt-1">
          Export attendance logs for <span className="font-semibold text-primary-600">{getDeptLabel(department)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
            <Filter size={18} className="text-primary-500" />
            Filters
          </h2>

          <div>
            <label className="label">Department</label>
            <select
              value={department}
              onChange={e => {
                setDepartment(e.target.value);
                setYear('');
                setSemester('');
                setSubject('');
              }}
              className="select"
            >
              {teachingDepartments.map(code => (
                <option key={code} value={code}>{code} — {getDeptLabel(code)}</option>
              ))}
            </select>
            <p className="text-xs text-surface-500 mt-1.5 font-medium">
              Reports are only available for departments you're assigned to teach.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Year</label>
              <select
                value={year}
                onChange={e => {
                  setYear(e.target.value);
                  setSemester('');
                }}
                className="select"
                disabled={!department}
              >
                <option value="">Select Year</option>
                {YEARS.map(y => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Semester</label>
              <select
                value={semester}
                onChange={e => setSemester(e.target.value)}
                className="select"
                disabled={!year}
              >
                <option value="">Select Semester</option>
                {availableSemesters.map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Report Period</label>
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                className="select"
              >
                <option value="daily">Daily Attendance</option>
                <option value="weekly">Weekly Attendance</option>
                <option value="monthly">Monthly Attendance</option>
                <option value="semester">Full Semester Attendance</option>
              </select>
            </div>
            <div>
              <label className="label">Subject (Optional)</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="select"
                disabled={!semester}
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {['daily', 'weekly', 'monthly'].includes(reportType) && (
            <div>
              <label className="label">Select Date / Period</label>
              <input
                type={reportType === 'monthly' ? 'month' : 'date'}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="input max-w-xs"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-surface-100">
            <button onClick={() => handleDownload('excel')} disabled={loading} className="btn-primary">
              <FileDown size={16} /> Excel (.xlsx)
            </button>
            <button onClick={() => handleDownload('csv')} disabled={loading} className="btn-secondary">
              <FileDown size={16} /> CSV
            </button>
          </div>
        </div>

        <div className="card p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
              <GraduationCap className="text-primary-500" />
              Class Summary
            </h2>
            {year && semester ? (
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-surface-50 text-sm">
                  <span className="text-surface-500">Students</span>
                  <span className="font-bold text-surface-900">{students.length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-surface-50 text-sm">
                  <span className="text-surface-500">Subjects</span>
                  <span className="font-bold text-surface-900">{subjects.length}</span>
                </div>
              </div>
            ) : (
              <p className="text-surface-400 text-sm text-center py-12">Select class filters to display roster details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
