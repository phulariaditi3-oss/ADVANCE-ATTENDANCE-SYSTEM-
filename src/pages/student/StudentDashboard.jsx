import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { calcAttendancePercentage } from '../../lib/utils';
import { LOW_ATTENDANCE_THRESHOLD } from '../../lib/constants';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { AlertCircle, ScanLine, CalendarClock, CheckCircle2, ScanFace } from 'lucide-react';
import { Link } from 'react-router-dom';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ attended: 0, total: 0, percentage: 0, absent: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [faceRegistered, setFaceRegistered] = useState(true); // assume true until checked, to avoid flashing the banner

  useEffect(() => {
    if (user?.id) {
      fetchStudentStats();
      fetchFaceStatus();
    }
  }, [user]);

  const fetchFaceStatus = async () => {
    try {
      const { data } = await supabase.rpc('face_registration_status', { p_student_id: user.id });
      setFaceRegistered(!!data?.registered);
    } catch {
      // Non-fatal — dashboard should still render if this check fails
    }
  };

  const fetchStudentStats = async () => {
    try {
      setLoading(true);
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, subject_name, created_at')
        .eq('department', user.department)
        .eq('year', user.year)
        .eq('semester', user.semester);

      const { data: attendance } = await supabase
        .from('attendance')
        .select('session_id, marked_at, latitude, longitude, distance_from_college')
        .eq('student_id', user.id);

      const totalClasses = sessions ? sessions.length : 0;
      const attendedClasses = attendance ? attendance.length : 0;
      const percentage = calcAttendancePercentage(attendedClasses, totalClasses);
      const absentClasses = totalClasses - attendedClasses;

      setStats({ attended: attendedClasses, total: totalClasses, percentage, absent: absentClasses });

      const logs = (sessions || []).map((sess) => {
        const mark = (attendance || []).find((a) => a.session_id === sess.id);
        return {
          id: sess.id,
          subject: sess.subject_name,
          date: sess.created_at,
          marked: !!mark,
        };
      });

      logs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentLogs(logs.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  const isLowAttendance = stats.total > 0 && stats.percentage < LOW_ATTENDANCE_THRESHOLD;
  const absentPercentage = stats.total > 0 ? (100 - stats.percentage).toFixed(1) : 0;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-5xl mx-auto space-y-6"
    >
      {/* Hero Section */}
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-100 to-surface-50 p-6 sm:p-8 border border-white/70"
      >
        <div className="absolute top-[-25%] right-[-8%] w-72 h-72 bg-primary-200/40 rounded-full blur-3xl pointer-events-none animate-float" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="eyebrow">Student Portal</p>
            <h1 className="text-2xl sm:text-3xl font-black text-surface-900 tracking-tight">
              Good morning, {user?.name?.split(' ')[0] || 'Student'} 👋
            </h1>
            <p className="text-sm font-medium text-surface-500 max-w-sm">
              Track your attendance, classes, and academic activity from one place.
            </p>
          </div>
          <Link to="/student/scan" className="btn-primary shrink-0 group !px-6 !py-3">
            <ScanLine size={18} className="group-hover:scale-110 transition-transform" />
            <span>Mark Attendance</span>
          </Link>
        </div>
      </motion.div>

      {/* Face Registration Prompt */}
      {!faceRegistered && (
        <motion.div
          variants={item}
          className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-primary-500 text-white shadow-[0_6px_20px_rgba(79,70,229,0.3)]"
        >
          <ScanFace className="shrink-0 mt-0.5" size={19} />
          <div className="flex-1">
            <p className="text-sm font-black">Face ID not registered</p>
            <p className="text-xs mt-1 font-semibold opacity-90 leading-relaxed">
              You need to register your face before you can scan and mark attendance.
            </p>
          </div>
          <Link to="/student/face-registration" className="shrink-0 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-lg text-xs font-black self-center">
            Register Now
          </Link>
        </motion.div>
      )}

      {/* Low Attendance Alert */}
      {isLowAttendance && (
        <motion.div
          variants={item}
          className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-danger-500 text-white shadow-[0_6px_20px_rgba(255,107,122,0.3)]"
        >
          <AlertCircle className="shrink-0 mt-0.5" size={19} />
          <div>
            <p className="text-sm font-black">Low Attendance Warning — below {LOW_ATTENDANCE_THRESHOLD}%</p>
            <p className="text-xs mt-1 font-semibold opacity-90 leading-relaxed">
              Your attendance is currently <strong>{stats.percentage}%</strong>. Attend upcoming lectures regularly to stay eligible for exams.
            </p>
          </div>
        </motion.div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={item} className="rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 text-white p-5 shadow-[0_8px_20px_rgba(34,214,138,0.28)] hover-lift flex items-center gap-4 h-24">
          <div className="icon-tile w-11 h-11 bg-white/20 shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide opacity-90">Present</p>
            <div className="text-2xl font-black leading-tight">{stats.percentage}%</div>
          </div>
        </motion.div>

        <motion.div variants={item} className="rounded-2xl bg-gradient-to-br from-danger-500 to-danger-600 text-white p-5 shadow-[0_8px_20px_rgba(255,107,122,0.28)] hover-lift flex items-center gap-4 h-24">
          <div className="icon-tile w-11 h-11 bg-white/20 shrink-0">
            <AlertCircle size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide opacity-90">Absent</p>
            <div className="text-2xl font-black leading-tight">{absentPercentage}%</div>
          </div>
        </motion.div>

        <motion.div variants={item} className="card-stats hover-lift flex items-center gap-4 h-24">
          <div className="icon-tile w-11 h-11 bg-primary-50 shrink-0">
            <CalendarClock size={19} className="text-primary-500" />
          </div>
          <div className="min-w-0">
            <p className="stat-label !text-[0.7rem] leading-tight">Attended</p>
            <div className="text-2xl font-black text-surface-900 leading-tight">{stats.attended}</div>
          </div>
        </motion.div>

        <motion.div variants={item} className="card-stats hover-lift flex items-center gap-4 h-24">
          <div className="icon-tile w-11 h-11 bg-danger-50 shrink-0">
            <AlertCircle size={19} className="text-danger-500" />
          </div>
          <div className="min-w-0">
            <p className="stat-label !text-[0.7rem] leading-tight">Missed</p>
            <div className="text-2xl font-black text-surface-900 leading-tight">{stats.absent}</div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Classes */}
        <motion.div variants={item} className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="section-title !text-lg">Recent Classes</h2>
              <p className="section-subtitle">Your latest sessions</p>
            </div>
            <Link to="/student/history" className="text-xs font-bold text-primary-500 hover:text-primary-700 transition-colors">
              View All →
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <CalendarClock size={26} className="text-surface-300" />
              </div>
              <h3 className="font-bold text-surface-700 text-sm">No classes recorded yet</h3>
              <p className="text-xs text-surface-400 font-medium max-w-xs">
                Your attendance history will show up here once your teacher starts a session.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar">
              {recentLogs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -3 }}
                  className="card-magenta min-w-[150px] flex flex-col justify-between h-36"
                >
                  <div>
                    <h3 className="font-bold text-sm truncate" title={log.subject}>{log.subject}</h3>
                    <p className="text-[11px] font-semibold text-white/75 mt-1.5 uppercase tracking-wide">
                      {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span
                    className={`inline-flex self-start px-3 py-1.5 rounded-full text-[11px] font-black ${
                      log.marked ? 'bg-accent-500' : 'bg-danger-500'
                    }`}
                  >
                    {log.marked ? 'PRESENT' : 'ABSENT'}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Overall Attendance Donut */}
        <motion.div variants={item} className="card p-6 flex flex-col items-center">
          <h2 className="section-title !text-base w-full text-left mb-6">Overall Attendance</h2>

          <div className="relative w-36 h-36 mb-6">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path
                className="text-surface-100"
                strokeDasharray="100, 100"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="currentColor" strokeWidth="3.5"
              />
              <motion.path
                className="text-accent-500"
                initial={{ strokeDasharray: '0, 100' }}
                animate={{ strokeDasharray: `${stats.percentage}, 100` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-surface-900">{stats.percentage}%</span>
              <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wide">Present</span>
            </div>
          </div>

          <div className="flex gap-5 text-xs font-bold text-surface-500">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-accent-500" /> Present</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-surface-100" /> Absent</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
