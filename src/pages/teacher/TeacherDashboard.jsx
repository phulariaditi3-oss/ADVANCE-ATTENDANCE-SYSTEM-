import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { calcAttendancePercentage, getGreeting } from '../../lib/utils';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import {
  QrCode, AlertTriangle, BookOpen, ArrowRight, CalendarClock, GraduationCap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sessionsCount: 0, studentsCount: 0, lowAttendanceCount: 0 });
  const [recentSessions, setRecentSessions] = useState([]);

  useEffect(() => {
    if (user?.department) fetchTeacherDashboard();
  }, [user]);

  const fetchTeacherDashboard = async () => {
    try {
      setLoading(true);

      const { count: sessionsCount } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', user.id);

      const { count: studentsCount } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('department', user.department)
        .eq('is_active', true);

      const { data: recent } = await supabase
        .from('sessions')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: allStudents } = await supabase
        .from('students')
        .select('id, department, year, semester')
        .eq('department', user.department)
        .eq('is_active', true);

      const { data: deptSessions } = await supabase
        .from('sessions')
        .select('id, department, year, semester')
        .eq('department', user.department);

      const { data: deptAttendance } = await supabase
        .from('attendance')
        .select('student_id, session_id')
        .eq('status', 'present');

      let lowCount = 0;
      if (allStudents && deptSessions) {
        const sessionCountMap = {};
        deptSessions.forEach((s) => {
          const key = `${s.department}_${s.year}_${s.semester}`;
          if (!sessionCountMap[key]) sessionCountMap[key] = [];
          sessionCountMap[key].push(s.id);
        });

        const studentPresentMap = {};
        if (deptAttendance) {
          deptAttendance.forEach((a) => {
            if (!studentPresentMap[a.student_id]) studentPresentMap[a.student_id] = 0;
            studentPresentMap[a.student_id]++;
          });
        }

        allStudents.forEach((st) => {
          const key = `${st.department}_${st.year}_${st.semester}`;
          const totalSessions = (sessionCountMap[key] || []).length;
          const attended = studentPresentMap[st.id] || 0;
          const pct = calcAttendancePercentage(attended, totalSessions);
          if (totalSessions > 0 && pct < 75) lowCount++;
        });
      }

      setStats({
        sessionsCount: sessionsCount || 0,
        studentsCount: studentsCount || 0,
        lowAttendanceCount: lowCount,
      });
      setRecentSessions(recent || []);
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  const quickActions = [
    { to: '/teacher/take-attendance', icon: QrCode, label: 'Start Session', color: 'bg-primary-500', shadow: 'shadow-[0_4px_12px_rgba(108,75,193,0.3)]' },
    { to: '/teacher/reports', icon: BookOpen, label: 'Class Reports', color: 'bg-primary-500', shadow: 'shadow-[0_4px_12px_rgba(108,75,193,0.3)]' },
    { to: '/teacher/low-attendance', icon: AlertTriangle, label: 'Attendance Alerts', color: 'bg-danger-500', shadow: 'shadow-[0_4px_12px_rgba(255,107,122,0.3)]' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Hero Section */}
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-100 to-surface-50 p-6 sm:p-8 border border-white/70"
      >
        <div className="absolute top-[-25%] right-[-8%] w-72 h-72 bg-primary-200/40 rounded-full blur-3xl pointer-events-none animate-float" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="eyebrow">Faculty Portal</p>
            <h1 className="text-2xl sm:text-3xl font-black text-surface-900 tracking-tight">
              {getGreeting()}, {user?.name?.split(' ')[0] || 'Professor'} 👋
            </h1>
            <p className="text-sm font-medium text-surface-500 max-w-sm">
              Here's your teaching overview. Manage your classes and students.
            </p>
          </div>
          <Link to="/teacher/take-attendance" className="btn-primary shrink-0 group !px-6 !py-3">
            <QrCode size={18} className="group-hover:scale-110 transition-transform" />
            <span>Start Session</span>
          </Link>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item} className="card-stats hover-lift flex items-center gap-4">
          <div className="icon-tile w-12 h-12 bg-primary-50">
            <QrCode size={20} className="text-primary-500" />
          </div>
          <div>
            <p className="stat-label">My Sessions</p>
            <p className="stat-value !text-3xl">{stats.sessionsCount}</p>
          </div>
        </motion.div>

        <motion.div variants={item} className="card-stats hover-lift flex items-center gap-4">
          <div className="icon-tile w-12 h-12 bg-accent-50">
            <GraduationCap size={20} className="text-accent-600" />
          </div>
          <div>
            <p className="stat-label">Dept Students</p>
            <p className="stat-value !text-3xl">{stats.studentsCount}</p>
          </div>
        </motion.div>

        <motion.div
          variants={item}
          className="rounded-2xl bg-gradient-to-br from-danger-500 to-danger-600 text-white p-5 shadow-[0_8px_20px_rgba(255,107,122,0.28)] hover-lift col-span-2 flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-bold uppercase tracking-wide opacity-90">Low Attendance Alerts</p>
            <div className="text-3xl font-black mt-1.5">{stats.lowAttendanceCount}</div>
          </div>
          <div className="icon-tile w-11 h-11 bg-white/20">
            <AlertTriangle size={20} />
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Sessions */}
        <motion.div variants={item} className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="section-title !text-lg">Recent Sessions</h2>
              <p className="section-subtitle">Your latest QR sessions</p>
            </div>
            <Link to="/teacher/sessions" className="text-xs font-bold text-primary-500 hover:text-primary-700 transition-colors">
              View All →
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <CalendarClock size={26} className="text-surface-300" />
              </div>
              <h3 className="font-bold text-surface-700 text-sm">No sessions generated yet</h3>
              <p className="text-xs text-surface-400 font-medium max-w-xs">
                Start your first QR session to see it appear here.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar">
              {recentSessions.map((session, i) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -3 }}
                  className="card-magenta min-w-[160px] flex flex-col justify-between h-36"
                >
                  <div>
                    <h3 className="font-bold text-sm line-clamp-2" title={session.subject_name}>{session.subject_name}</h3>
                    <p className="text-[11px] font-semibold text-white/75 mt-1.5 uppercase tracking-wide">
                      {new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-black leading-none">{session.total_present}</p>
                      <p className="text-[11px] font-semibold text-white/75 uppercase mt-1">Present</p>
                    </div>
                    <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <QrCode size={13} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={item} className="card p-6 flex flex-col gap-4">
          <h2 className="section-title !text-lg">Quick Actions</h2>

          <div className="space-y-2.5 flex-1">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-50 hover:bg-primary-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={`icon-tile w-9 h-9 text-white group-hover:scale-110 ${action.color} ${action.shadow}`}>
                    <action.icon size={16} />
                  </div>
                  <span className="text-sm font-bold text-surface-800">{action.label}</span>
                </div>
                <ArrowRight size={15} className="text-surface-400 group-hover:translate-x-1 group-hover:text-primary-600 transition-all" />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
