import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { LOW_ATTENDANCE_THRESHOLD } from '../../lib/constants';
import { calcAttendancePercentage } from '../../lib/utils';
import { AlertTriangle, Phone, Search } from 'lucide-react';

export default function TeacherLowAttendance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.department) {
      fetchDeptLowAttendance();
    }
  }, [user]);

  const fetchDeptLowAttendance = async () => {
    try {
      setLoading(true);
      
      // Get all active students in teacher's department
      const { data: studentList } = await supabase
        .from('students')
        .select('*')
        .eq('department', user.department)
        .eq('is_active', true);

      // Get all sessions conducted in teacher's department
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, department, year, semester')
        .eq('department', user.department);

      // Get present logs
      const { data: attendance } = await supabase
        .from('attendance')
        .select('student_id, session_id')
        .eq('status', 'present');

      if (!studentList) return;

      // Map sessions by key
      const sessionCountMap = {};
      if (sessions) {
        sessions.forEach(s => {
          const key = `${s.department}_${s.year}_${s.semester}`;
          if (!sessionCountMap[key]) sessionCountMap[key] = [];
          sessionCountMap[key].push(s.id);
        });
      }

      // Map present logs
      const presentMap = {};
      if (attendance) {
        attendance.forEach(a => {
          if (!presentMap[a.student_id]) presentMap[a.student_id] = 0;
          presentMap[a.student_id]++;
        });
      }

      const alertList = [];
      studentList.forEach(st => {
        const key = `${st.department}_${st.year}_${st.semester}`;
        const total = (sessionCountMap[key] || []).length;
        const attended = presentMap[st.id] || 0;
        const percentage = calcAttendancePercentage(attended, total);

        if (total > 0 && percentage < LOW_ATTENDANCE_THRESHOLD) {
          alertList.push({
            ...st,
            attended,
            total,
            percentage
          });
        }
      });

      alertList.sort((a, b) => a.percentage - b.percentage);
      setStudents(alertList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.enrollment_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Low Attendance Alerts</h1>
          <p className="text-surface-500 mt-1">
            Department: <span className="font-semibold text-primary-600">{user.department}</span> • Limit: {LOW_ATTENDANCE_THRESHOLD}%
          </p>
        </div>
        <div className="flex items-center gap-2 p-2 px-4 rounded-xl bg-danger-50 text-danger-700 border border-danger-150">
          <AlertTriangle size={18} />
          <span className="text-sm font-bold">{students.length} Alerted Students</span>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input !pl-12 py-3 rounded-2xl"
          placeholder="Search student..."
        />
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Student Details</th>
                <th>Academic Year</th>
                <th>Classes</th>
                <th>Attendance</th>
                <th>Student Mobile</th>
                <th>Parent Mobile</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-surface-500">
                      <div className="w-5 h-5 border-2 border-surface-300 border-t-danger-500 rounded-full animate-spin" />
                      Checking records...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-surface-400">
                    No students currently below {LOW_ATTENDANCE_THRESHOLD}%.
                  </td>
                </tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id}>
                    <td className="font-bold text-surface-900">{s.roll_no}</td>
                    <td>
                      <div>
                        <p className="font-semibold text-surface-900">{s.name}</p>
                        <p className="text-xs font-mono text-surface-500">{s.enrollment_no}</p>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs font-medium text-surface-600">
                        Year {s.year} • Sem {s.semester}
                      </span>
                    </td>
                    <td className="text-sm font-medium">
                      {s.attended} / {s.total}
                    </td>
                    <td>
                      <span className="badge badge-danger">{s.percentage}%</span>
                    </td>
                    <td>
                      <span className="flex items-center gap-1 text-xs font-mono text-surface-700">
                        <Phone size={12} className="text-surface-400" />
                        {s.student_mobile}
                      </span>
                    </td>
                    <td>
                      <span className="flex items-center gap-1 text-xs font-mono text-primary-600 font-bold">
                        <Phone size={12} />
                        {s.parent_mobile}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
