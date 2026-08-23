import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sun, Sunset, CalendarDays, Loader2 } from 'lucide-react';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatDate = iso =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const StatusBadge = ({ status }) =>
  status === 'present'
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">🟢 Present</span>
    : status === 'absent'
      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-danger-50 text-danger-600 border border-danger-100">🔴 Absent</span>
      : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-surface-100 text-surface-400 border border-surface-200">— Not Taken</span>;

export default function DailyAttendanceHistory() {
  const { user } = useAuth();
  const [month, setMonth]   = useState(currentMonth());
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [y, m] = month.split('-');
      const startDate = `${y}-${m}-01`;
      const endDate   = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('attendance')
        .select(`
          status,
          session:sessions!inner(
            session_date,
            session_type,
            attendance_type
          )
        `)
        .eq('student_id', user.id)
        .eq('session.attendance_type', 'daily')
        .gte('session.session_date', startDate)
        .lte('session.session_date', endDate)
        // Note: Ordering by nested fields in PostgREST can be tricky, we'll sort in JS
        ;

      if (error) throw error;
      
      // Map to the format the UI expects
      const formattedData = (data || []).map(r => ({
        date: r.session.session_date,
        session_type: r.session.session_type,
        status: r.status
      }));
      
      formattedData.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setRecords(formattedData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, [user?.id, month]);

  /* Group by date */
  const grouped = useMemo(() => {
    const map = {};
    records.forEach(r => {
      if (!map[r.date]) map[r.date] = { morning: null, afternoon: null };
      map[r.date][r.session_type] = r.status;
    });
    return Object.entries(map).sort(([a], [b]) => new Date(b) - new Date(a));
  }, [records]);

  /* Summary */
  const morningPresent   = records.filter(r => r.session_type === 'morning'   && r.status === 'present').length;
  const afternoonPresent = records.filter(r => r.session_type === 'afternoon' && r.status === 'present').length;
  const morningTotal     = records.filter(r => r.session_type === 'morning').length;
  const afternoonTotal   = records.filter(r => r.session_type === 'afternoon').length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/student"
          className="p-2.5 rounded-2xl bg-white shadow-sm border border-surface-200 text-surface-600 hover:text-primary-600 hover:border-primary-200 transition"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-surface-900">Daily Attendance History</h1>
          <p className="text-xs font-bold text-surface-500 mt-0.5">Your morning &amp; afternoon attendance record</p>
        </div>
      </div>

      {/* Month Picker */}
      <div className="card p-4 flex items-center gap-3">
        <CalendarDays size={16} className="text-primary-500 shrink-0" />
        <label className="text-sm font-bold text-surface-700 shrink-0">Month:</label>
        <input
          type="month"
          value={month}
          max={currentMonth()}
          onChange={e => setMonth(e.target.value)}
          className="input flex-1"
        />
      </div>

      {/* Summary Cards */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 border border-amber-100 bg-amber-50/50">
            <div className="flex items-center gap-2 mb-2">
              <Sun size={14} className="text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Morning</p>
            </div>
            <p className="text-2xl font-black text-amber-700">{morningPresent}<span className="text-sm text-amber-400 font-bold">/{morningTotal}</span></p>
            <p className="text-xs font-bold text-amber-500 mt-0.5">
              {morningTotal > 0 ? ((morningPresent / morningTotal) * 100).toFixed(1) : 0}% Present
            </p>
          </div>
          <div className="card p-4 border border-indigo-100 bg-indigo-50/50">
            <div className="flex items-center gap-2 mb-2">
              <Sunset size={14} className="text-indigo-500" />
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Afternoon</p>
            </div>
            <p className="text-2xl font-black text-indigo-700">{afternoonPresent}<span className="text-sm text-indigo-400 font-bold">/{afternoonTotal}</span></p>
            <p className="text-xs font-bold text-indigo-500 mt-0.5">
              {afternoonTotal > 0 ? ((afternoonPresent / afternoonTotal) * 100).toFixed(1) : 0}% Present
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card p-10 flex flex-col items-center text-center">
          <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin mb-3" />
          <p className="text-sm font-bold text-surface-500">Loading history…</p>
        </div>
      )}

      {/* History Table */}
      {!loading && grouped.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-surface-500">Date</th>
                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-amber-500">
                  <Sun size={12} className="inline mr-1" />Morning
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-indigo-500">
                  <Sunset size={12} className="inline mr-1" />Afternoon
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {grouped.map(([date, sessions], i) => (
                <motion.tr
                  key={date}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-surface-50 transition-colors"
                >
                  <td className="px-4 py-3 font-bold text-surface-800">{formatDate(date)}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={sessions.morning} /></td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={sessions.afternoon} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && grouped.length === 0 && (
        <div className="card p-10 text-center text-surface-400">
          <CalendarDays size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-bold text-sm">No daily attendance records for this month.</p>
        </div>
      )}
    </div>
  );
}
