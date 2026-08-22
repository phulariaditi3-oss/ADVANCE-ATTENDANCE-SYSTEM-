import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DEPARTMENTS, YEARS, YEAR_SEMESTERS } from '../../lib/constants';
import { generateExcelReport, generateCSVReport } from '../../lib/reports';
import { useToast } from '../../contexts/ToastContext';
import { FileDown, Calendar, GraduationCap, Clock, Filter, BookOpen } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export default function AdminReports() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('semester'); // daily, weekly, monthly, semester, individual
  
  // Selection states
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Data pools
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Fetch students & subjects when filters change
  useEffect(() => {
    if (department && year && semester) {
      fetchStudentsAndSubjects();
    } else {
      setStudents([]);
      setSubjects([]);
    }
  }, [department, year, semester]);

  const fetchStudentsAndSubjects = async () => {
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
      console.error('Fetch error:', err);
    }
  };

  const handleGenerateReport = async (format) => {
    if (!department || !year || !semester) {
      toast.warning('Please select Department, Year, and Semester first.');
      return;
    }
    if (students.length === 0) {
      toast.warning('No students found for the selected class criteria.');
      return;
    }

    setLoading(true);
    try {
      let sessionsQuery = supabase
        .from('sessions')
        .select('id, created_at, subject_name')
        .eq('department', department)
        .eq('year', parseInt(year))
        .eq('semester', parseInt(semester));

      if (subject) {
        sessionsQuery = sessionsQuery.eq('subject_id', subject);
      }

      // Handle time-based filters
      if (reportType === 'daily') {
        const start = `${selectedDate}T00:00:00.000Z`;
        const end = `${selectedDate}T23:59:59.999Z`;
        sessionsQuery = sessionsQuery.gte('created_at', start).lte('created_at', end);
      } else if (reportType === 'weekly') {
        const dateObj = new Date(selectedDate);
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const monday = new Date(dateObj.setDate(diff)).toISOString().split('T')[0];
        const sundayObj = new Date(dateObj.setDate(diff + 6));
        const sunday = sundayObj.toISOString().split('T')[0];
        sessionsQuery = sessionsQuery.gte('created_at', `${monday}T00:00:00.000Z`).lte('created_at', `${sunday}T23:59:59.999Z`);
      } else if (reportType === 'monthly') {
        const parts = selectedDate.split('-'); // YYYY-MM
        const yearVal = parts[0];
        const monthVal = parts[1];
        const lastDay = new Date(yearVal, monthVal, 0).getDate();
        sessionsQuery = sessionsQuery
          .gte('created_at', `${yearVal}-${monthVal}-01T00:00:00.000Z`)
          .lte('created_at', `${yearVal}-${monthVal}-${lastDay}T23:59:59.999Z`);
      }

      const { data: sessions, error: sessionErr } = await sessionsQuery;
      if (sessionErr) throw sessionErr;

      if (!sessions || sessions.length === 0) {
        toast.warning('No attendance sessions found matching the filter criteria.');
        setLoading(false);
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      // Fetch attendance
      const { data: attendance, error: attErr } = await supabase
        .from('attendance')
        .select('session_id, student_id, status')
        .in('session_id', sessionIds)
        .eq('status', 'present');

      if (attErr) throw attErr;

      // Construct attendance map for reports
      const attendanceMap = {};
      attendance.forEach(a => {
        attendanceMap[`${a.session_id}_${a.student_id}`] = true;
      });

      const selectedSubjObj = subjects.find(s => s.id === subject);
      const subjectLabel = selectedSubjObj ? selectedSubjObj.name : 'All Subjects';

      const title = `${reportType.toUpperCase()} ATTENDANCE REPORT`;

      const reportConfig = {
        title,
        department,
        year,
        semester,
        subject: subjectLabel,
        students,
        sessions,
        attendanceMap,
      };

      if (format === 'excel') {
        await generateExcelReport(reportConfig);
        toast.success('Excel report downloaded successfully!');
      } else {
        generateCSVReport(reportConfig);
        toast.success('CSV report downloaded successfully!');
      }
    } catch (err) {
      toast.error('Failed to generate report.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const availableSemesters = year ? YEAR_SEMESTERS[parseInt(year)] || [] : [];

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Attendance Reports</h1>
        <p className="text-surface-500 mt-1 font-medium">Download reports in Excel or CSV formats</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configurations Card */}
        <div className="card p-6 lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2">
            <Filter size={18} className="text-primary-500" />
            Report Settings
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Department</label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="select"
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <select
                value={year}
                onChange={e => {
                  setYear(e.target.value);
                  setSemester('');
                }}
                className="select"
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
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time Picker */}
          {['daily', 'weekly', 'monthly'].includes(reportType) && (
            <div className="animate-fade-in">
              <label className="label">
                {reportType === 'daily' && 'Select Date'}
                {reportType === 'weekly' && 'Select Any Date in Week'}
                {reportType === 'monthly' && 'Select Month'}
              </label>
              <input
                type={reportType === 'monthly' ? 'month' : 'date'}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="input max-w-xs"
              />
            </div>
          )}

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-surface-100">
            <button
              onClick={() => handleGenerateReport('excel')}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><FileDown size={16} /> Download Excel (.xlsx)</>
              )}
            </button>
            <button
              onClick={() => handleGenerateReport('csv')}
              disabled={loading}
              className="btn-secondary"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-surface-300 border-t-primary-500 rounded-full animate-spin" />
              ) : (
                <><FileDown size={16} /> Download CSV</>
              )}
            </button>
          </div>
        </div>

        {/* Overview Box */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
              <GraduationCap className="text-primary-500" />
              Class Summary
            </h2>
            {department && year && semester ? (
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-surface-50 text-sm">
                  <span className="text-surface-500">Students Registered</span>
                  <span className="font-bold text-surface-900">{students.length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-surface-50 text-sm">
                  <span className="text-surface-500">Subjects Mapped</span>
                  <span className="font-bold text-surface-900">{subjects.length}</span>
                </div>
              </div>
            ) : (
              <p className="text-surface-400 text-sm text-center py-12">
                Configure settings to view class information.
              </p>
            )}
          </div>

          <div className="mt-6 bg-surface-50 p-4 rounded-xl text-xs text-surface-500 leading-relaxed border border-surface-100">
            <strong>Roll Number Sorting:</strong> All generated documents will be strictly ordered by roll numbers (1, 2, 3...) to assist administrative logging.
          </div>
        </div>
      </div>
    </div>
  );
}
