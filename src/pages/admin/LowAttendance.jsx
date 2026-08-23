import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getDeptLabel, LOW_ATTENDANCE_THRESHOLD } from '../../lib/constants';
import { AlertTriangle, Phone, Search, CheckCircle2, Loader2, MessageSquare } from 'lucide-react';
import { calcAttendancePercentage } from '../../lib/utils';

export default function LowAttendance() {
  const { role, user } = useAuth();
  const isHod = role === 'hod';
  const hodDept = isHod ? user?.department : null;

  const [loading, setLoading] = useState(true);
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState(hodDept || '');

  useEffect(() => {
    fetchLowAttendance();
  }, [hodDept]);

  const fetchLowAttendance = async () => {
    try {
      setLoading(true);
      let studentsQ = supabase
        .from('students')
        .select('*')
        .eq('is_active', true);
      if (hodDept) studentsQ = studentsQ.eq('department', hodDept);
      const { data: students, error: studentErr } = await studentsQ;
      if (studentErr) throw studentErr;

      const { data: sessions, error: sessionErr } = await supabase.from('sessions').select('*');
      if (sessionErr) throw sessionErr;

      const { data: attendance, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('status', 'present');
      if (attErr) throw attErr;

      const sessionCountMap = {};
      sessions.forEach(s => {
        const key = `${s.department}_${s.year}_${s.semester}`;
        if (!sessionCountMap[key]) sessionCountMap[key] = [];
        sessionCountMap[key].push(s.id);
      });

      const studentPresentMap = {};
      attendance.forEach(a => {
        if (!studentPresentMap[a.student_id]) studentPresentMap[a.student_id] = 0;
        studentPresentMap[a.student_id]++;
      });

      const resultList = [];
      students.forEach(student => {
        const key = `${student.department}_${student.year}_${student.semester}`;
        const studentSessions = sessionCountMap[key] || [];
        const totalClasses = studentSessions.length;
        const attendedClasses = studentPresentMap[student.id] || 0;
        const pct = calcAttendancePercentage(attendedClasses, totalClasses);

        if (totalClasses > 0 && pct < LOW_ATTENDANCE_THRESHOLD) {
          resultList.push({ ...student, attendedClasses, totalClasses, percentage: pct });
        }
      });

      resultList.sort((a, b) => a.percentage - b.percentage);
      setLowAttendanceStudents(resultList);
    } catch (err) {
      console.error('Error fetching low attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = lowAttendanceStudents.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollment_no.toLowerCase().includes(search.toLowerCase());
    const matchDept = !deptFilter || s.department === deptFilter;
    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 tracking-tight">Low Attendance Warnings</h1>
          <p className="section-subtitle mt-1">Students below minimum threshold ({LOW_ATTENDANCE_THRESHOLD}%)</p>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-danger-50 text-danger-700 border border-danger-100">
          <AlertTriangle size={17} className={lowAttendanceStudents.length > 0 ? 'animate-pulse-soft text-danger-500' : 'text-danger-500'} />
          <span className="text-xs font-black">{lowAttendanceStudents.length} Alerted Students</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input !pl-11"
            placeholder="Search student name or enrollment..."
          />
        </div>
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="select w-auto"
        >
          <option value="">All Departments</option>
          <option value="ME">Mechanical</option>
          <option value="CE">Civil</option>
          <option value="CO">Computer</option>
          <option value="EJ">Electronics</option>
        </select>
      </div>

      {/* List Card */}
      <div className="card overflow-hidden">
        <div className="table-container !bg-transparent">
          <table className="table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Student Details</th>
                <th>Department</th>
                <th>Class Count</th>
                <th>Percentage</th>
                <th>Student Mobile</th>
                <th>Parent Mobile</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <div className="flex items-center justify-center gap-2.5 text-surface-500 font-semibold text-sm">
                      <Loader2 size={18} className="animate-spin text-primary-500" />
                      Scanning student records...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon !bg-accent-50">
                        <CheckCircle2 size={28} className="text-accent-500" />
                      </div>
                      <h3 className="font-black text-surface-800 text-base">All Clear!</h3>
                      <p className="text-xs text-surface-400 font-medium max-w-xs leading-relaxed">
                        No students currently below {LOW_ATTENDANCE_THRESHOLD}% attendance requirement. Excellent performance!
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((s, index) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <td className="font-black text-surface-900">{s.roll_no}</td>
                    <td>
                      <p className="font-bold text-surface-900">{s.name}</p>
                      <p className="text-xs font-semibold text-surface-400">{s.enrollment_no}</p>
                    </td>
                    <td>
                      <span className="badge badge-info font-bold">{s.department}</span>
                      <span className="text-xs text-surface-500 font-medium ml-1.5">Yr {s.year} • Sem {s.semester}</span>
                    </td>
                    <td className="text-sm font-bold text-surface-600">
                      {s.attendedClasses} / {s.totalClasses}
                    </td>
                    <td>
                      <span className="badge badge-danger font-black">{s.percentage}%</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-surface-600">
                          {s.student_mobile}
                        </span>
                        <div className="flex gap-1">
                          <a href={`tel:+91${s.student_mobile}`} className="p-1.5 rounded-md bg-surface-100 hover:bg-surface-200 text-surface-600 transition-colors" title="Call">
                            <Phone size={14} />
                          </a>
                          <a href={`sms:+91${s.student_mobile}`} className="p-1.5 rounded-md bg-surface-100 hover:bg-surface-200 text-surface-600 transition-colors" title="SMS">
                            <MessageSquare size={14} />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-danger-600">
                          {s.parent_mobile}
                        </span>
                        <div className="flex gap-1">
                          <a href={`tel:+91${s.parent_mobile}`} className="p-1.5 rounded-md bg-danger-50 hover:bg-danger-100 text-danger-600 transition-colors" title="Call Parent">
                            <Phone size={14} />
                          </a>
                          <a href={`sms:+91${s.parent_mobile}`} className="p-1.5 rounded-md bg-danger-50 hover:bg-danger-100 text-danger-600 transition-colors" title="SMS Parent">
                            <MessageSquare size={14} />
                          </a>
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
