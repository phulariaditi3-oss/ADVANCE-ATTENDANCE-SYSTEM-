import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DEPARTMENTS } from '../../lib/constants';
import { calcAttendancePercentage } from '../../lib/utils';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { BarChart3, TrendingUp, Award, Clock } from 'lucide-react';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } };

export default function AttendanceStats() {
  const { role, user } = useAuth();
  const isHod = role === 'hod';
  const hodDept = isHod ? user?.department : null;

  const [loading, setLoading] = useState(true);
  const [deptStats, setDeptStats] = useState([]);
  const [overallAvg, setOverallAvg] = useState(0);

  useEffect(() => {
    fetchStats();
  }, [hodDept]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      let studentsQ = supabase.from('students').select('id, department, year, semester');
      let sessionsQ = supabase.from('sessions').select('id, department, year, semester');
      if (hodDept) {
        studentsQ = studentsQ.eq('department', hodDept);
        sessionsQ = sessionsQ.eq('department', hodDept);
      }
      const { data: students } = await studentsQ;
      const { data: sessions } = await sessionsQ;
      const { data: attendance } = await supabase.from('attendance').select('student_id, session_id, status').eq('status', 'present');

      if (!students || !sessions) return;

      const sessionsByDept = {};
      sessions.forEach(s => {
        if (!sessionsByDept[s.department]) sessionsByDept[s.department] = [];
        sessionsByDept[s.department].push(s.id);
      });

      const studentsByDept = {};
      students.forEach(st => {
        if (!studentsByDept[st.department]) studentsByDept[st.department] = [];
        studentsByDept[st.department].push(st.id);
      });

      let totalExpectedAttendance = 0;
      let totalActualAttendance = 0;

      const stats = DEPARTMENTS.map(dept => {
        const deptCode = dept.value;
        const deptStudents = studentsByDept[deptCode] || [];
        const studentIds = new Set(deptStudents);
        const deptSessions = sessionsByDept[deptCode] || [];
        const sessionIds = new Set(deptSessions);

        let expected = 0;
        deptStudents.forEach(st => {
          const studentObj = students.find(s => s.id === st);
          if (studentObj) {
            const matchingSessions = sessions.filter(s =>
              s.department === deptCode &&
              s.year === studentObj.year &&
              s.semester === studentObj.semester
            );
            expected += matchingSessions.length;
          }
        });

        const presentCount = attendance ? attendance.filter(a =>
          studentIds.has(a.student_id) && sessionIds.has(a.session_id)
        ).length : 0;

        totalExpectedAttendance += expected;
        totalActualAttendance += presentCount;

        const percentage = calcAttendancePercentage(presentCount, expected);

        return {
          department: deptCode,
          label: dept.label,
          sessionsCount: deptSessions.length,
          studentsCount: deptStudents.length,
          presentCount,
          expected,
          percentage
        };
      });

      setDeptStats(stats);
      setOverallAvg(calcAttendancePercentage(totalActualAttendance, totalExpectedAttendance));
    } catch (err) {
      console.error('Error fetching statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  const best = deptStats.length > 0 ? [...deptStats].sort((a, b) => b.percentage - a.percentage)[0] : null;
  const totalSessions = deptStats.reduce((sum, d) => sum + d.sessionsCount, 0);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-surface-900 tracking-tight">Attendance Statistics</h1>
        <p className="section-subtitle mt-1">Analytics and performance monitoring</p>
      </div>

      {/* Overall Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={item} className="card p-5 flex items-center gap-4 hover-lift">
          <div className="icon-tile w-[52px] h-[52px] bg-primary-100">
            <TrendingUp size={22} className="text-primary-600" />
          </div>
          <div>
            <p className="stat-label">Overall Average</p>
            <p className="stat-value !text-3xl text-primary-600">{overallAvg}%</p>
          </div>
        </motion.div>

        <motion.div variants={item} className="card p-5 flex items-center gap-4 hover-lift">
          <div className="icon-tile w-[52px] h-[52px] bg-accent-100">
            <Award size={22} className="text-accent-600" />
          </div>
          <div>
            <p className="stat-label">Best Performing Dept</p>
            <p className="text-xl font-black text-surface-900 mt-0.5">
              {best ? `${best.department} (${best.percentage}%)` : 'N/A'}
            </p>
          </div>
        </motion.div>

        <motion.div variants={item} className="card p-5 flex items-center gap-4 hover-lift">
          <div className="icon-tile w-[52px] h-[52px] bg-warning-100">
            <Clock size={22} className="text-warning-600" />
          </div>
          <div>
            <p className="stat-label">Conducted Sessions</p>
            <p className="text-xl font-black text-surface-900 mt-0.5">{totalSessions} Sessions</p>
          </div>
        </motion.div>
      </div>

      {/* Department Comparison */}
      <motion.div variants={item} className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-tile w-10 h-10 bg-surface-50">
            <BarChart3 size={18} className="text-primary-500" />
          </div>
          <h2 className="section-title !text-lg">Departmental Breakdown</h2>
        </div>
        <div className="space-y-6">
          {deptStats.map((d, i) => (
            <div key={i} className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="md:w-60 shrink-0">
                <p className="font-bold text-surface-900 text-sm">{d.label}</p>
                <p className="text-xs text-surface-500 font-medium mt-0.5">
                  {d.studentsCount} Students • {d.sessionsCount} Sessions conducted
                </p>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-surface-500">
                    Present: {d.presentCount} / Expected: {d.expected} slots
                  </span>
                  <span className={`text-sm font-black ${d.percentage >= 75 ? 'text-accent-600' : 'text-danger-600'}`}>
                    {d.percentage}%
                  </span>
                </div>
                <div className="h-2.5 bg-surface-150 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${d.percentage}%` }}
                    transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      d.percentage >= 75
                        ? 'bg-gradient-to-r from-primary-500 to-accent-500'
                        : 'bg-gradient-to-r from-danger-400 to-danger-600'
                    }`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
