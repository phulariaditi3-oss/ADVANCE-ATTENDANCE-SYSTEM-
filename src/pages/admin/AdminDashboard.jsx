import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getDeptLabel } from '../../lib/constants';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import {
  Users, GraduationCap, QrCode, AlertTriangle, Activity, Calendar,
  Shield, BarChart3, CalendarClock,
} from 'lucide-react';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function AdminDashboard() {
  const { role, user } = useAuth();
  const isHod = role === 'hod';
  const hodDept = isHod ? user?.department : null;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStaff: 0,
    totalStudents: 0,
    todaySessions: 0,
    lowAttendance: 0,
  });
  const [recentSessions, setRecentSessions] = useState([]);
  const [deptBreakdown, setDeptBreakdown] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [hodDept]);

  const fetchDashboardData = async () => {
    try {
      let staffQuery = supabase.from('staff').select('id', { count: 'exact', head: true });
      let studentsQuery = supabase.from('students').select('id', { count: 'exact', head: true });
      let sessionsQuery = supabase.from('sessions').select('id', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]);

      if (hodDept) {
        staffQuery = staffQuery.eq('department', hodDept);
        studentsQuery = studentsQuery.eq('department', hodDept);
        sessionsQuery = sessionsQuery.eq('department', hodDept);
      }

      const [staffRes, studentsRes, sessionsRes] = await Promise.all([
        staffQuery,
        studentsQuery,
        sessionsQuery,
      ]);

      let studentsListQuery = supabase.from('students').select('department, year');
      if (hodDept) studentsListQuery = studentsListQuery.eq('department', hodDept);
      const { data: students } = await studentsListQuery;

      const deptMap = {};
      (students || []).forEach(s => {
        if (!deptMap[s.department]) deptMap[s.department] = 0;
        deptMap[s.department]++;
      });
      const breakdown = Object.entries(deptMap).map(([dept, count]) => ({ dept, count }));

      let sessionsListQuery = supabase
        .from('sessions')
        .select('*, staff:teacher_id(name)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (hodDept) sessionsListQuery = sessionsListQuery.eq('department', hodDept);
      const { data: sessions } = await sessionsListQuery;

      setStats({
        totalStaff: staffRes.count || 0,
        totalStudents: studentsRes.count || 0,
        todaySessions: sessionsRes.count || 0,
        lowAttendance: 0,
      });
      setRecentSessions(sessions || []);
      setDeptBreakdown(breakdown);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  const statCards = [
    { label: 'Total Faculty', value: stats.totalStaff, icon: Users, color: '#4F46E5', bg: '#E0E7FF' },
    { label: 'Total Students', value: stats.totalStudents, icon: GraduationCap, color: '#059669', bg: '#D1FAE5' },
    { label: "Today's Sessions", value: stats.todaySessions, icon: QrCode, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Low Attendance', value: stats.lowAttendance, icon: AlertTriangle, color: '#DC2626', bg: '#FEE2E2' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">

      {/* Hero Banner */}
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-3xl p-7 md:p-10"
        style={{
          background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 60%, #3730A3 100%)',
          boxShadow: '0 12px 36px rgba(79, 70, 229, 0.32)',
        }}
      >
        <div className="absolute top-[-30%] right-[-5%] w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none animate-float" />
        <div className="absolute bottom-[-40%] left-[20%] w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="icon-tile w-10 h-10 bg-white/20 backdrop-blur-sm">
                <Shield size={20} className="text-white" />
              </div>
              <span className="text-white/70 text-xs font-bold uppercase tracking-widest">
                {isHod ? 'HOD Portal' : 'Admin Portal'}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">
              {isHod ? `${getDeptLabel(hodDept)} HOD Dashboard` : 'Admin Dashboard'}
            </h1>
            <p className="text-white/75 text-sm font-medium mt-2 max-w-lg">
              {isHod
                ? `Manage students and attendance for ${getDeptLabel(hodDept)} department.`
                : 'Manage your institution, students, staff, HODs and attendance from one place.'}
            </p>
          </div>
          <div className="flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20">
              <Activity size={16} className="text-white" />
              <span className="text-white font-semibold text-xs">System Active</span>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20">
              <Calendar size={16} className="text-white" />
              <span className="text-white font-semibold text-xs">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <motion.div key={card.label} variants={item} whileHover={{ y: -3 }} className="card p-5 flex items-center gap-4 cursor-default">
            <div className="icon-tile w-14 h-14" style={{ background: card.bg }}>
              <card.icon size={24} style={{ color: card.color }} />
            </div>
            <div className="min-w-0">
              <p className="stat-label truncate">{card.label}</p>
              <p className="stat-value" style={{ color: card.color }}>{card.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent Sessions */}
        <motion.div variants={item} className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="section-title !text-lg">Recent QR Sessions</h2>
              <p className="section-subtitle">Latest attendance sessions</p>
            </div>
            <div className="icon-tile w-10 h-10 bg-surface-50">
              <QrCode size={18} className="text-primary-500" />
            </div>
          </div>

          {recentSessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <CalendarClock size={26} className="text-surface-300" />
              </div>
              <h3 className="font-bold text-surface-700 text-sm">No sessions today</h3>
              <p className="text-xs text-surface-400 font-medium max-w-xs">
                Sessions will appear here once teachers start classes.
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
                  className="card-magenta min-w-[170px] flex flex-col justify-between h-36"
                >
                  <div>
                    <h3 className="font-bold text-sm line-clamp-2 leading-snug">{session.subject_name}</h3>
                    <p className="text-[11px] font-semibold text-white/75 mt-1.5 uppercase tracking-wide">
                      by {session.staff?.name || 'Faculty'}
                    </p>
                  </div>
                  <span className="inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-white text-[11px] font-black">
                    <Activity size={12} />
                    {session.total_present} Present
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Department Breakdown */}
        <motion.div variants={item} className="card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="section-title !text-lg">Department Enrollment</h2>
              <p className="section-subtitle">Students per department</p>
            </div>
            <div className="icon-tile w-10 h-10 bg-surface-50">
              <BarChart3 size={18} className="text-primary-500" />
            </div>
          </div>

          {deptBreakdown.length === 0 ? (
            <div className="empty-state flex-1">
              <div className="empty-state-icon">
                <GraduationCap size={26} className="text-surface-300" />
              </div>
              <h3 className="font-bold text-surface-700 text-sm">No students enrolled</h3>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {deptBreakdown.map((item, i) => {
                const maxCount = Math.max(...deptBreakdown.map(d => d.count));
                const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-surface-700">{getDeptLabel(item.dept)}</span>
                      <span className="text-sm font-black text-primary-500">{item.count} students</span>
                    </div>
                    <div className="h-2.5 bg-surface-50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #4F46E5, #4338CA)' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

      </div>
    </motion.div>
  );
}
