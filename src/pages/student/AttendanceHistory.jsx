import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getSemesterLabel } from '../../lib/constants';
import { formatDateTime } from '../../lib/utils';
import { Calendar, Search, MapPin, CheckCircle, XCircle } from 'lucide-react';

export default function AttendanceHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [subjectsList, setSubjectsList] = useState([]);

  useEffect(() => {
    if (user?.id) {
      fetchStudentHistory();
    }
  }, [user]);

  const fetchStudentHistory = async () => {
    try {
      setLoading(true);
      // Fetch sessions for student's class
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('department', user.department)
        .eq('year', user.year)
        .eq('semester', user.semester)
        .order('created_at', { ascending: false });

      // Fetch student attendance logs
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user.id);

      if (sessions) {
        // Unique subject list for filter dropdown
        const uniqueSubjects = Array.from(new Set(sessions.map(s => s.subject_name)));
        setSubjectsList(uniqueSubjects);

        // Combine logs
        const combined = sessions.map(sess => {
          const checkIn = (attendance || []).find(a => a.session_id === sess.id);
          return {
            id: sess.id,
            subject: sess.subject_name,
            sessionDate: sess.created_at,
            present: !!checkIn,
            markedAt: checkIn ? checkIn.marked_at : null,
            latitude: checkIn ? checkIn.latitude : null,
            longitude: checkIn ? checkIn.longitude : null,
            distance: checkIn ? checkIn.distance_from_college : null,
          };
        });
        setLogs(combined);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    return !subjectFilter || log.subject === subjectFilter;
  });

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Attendance History</h1>
        <p className="text-sm text-surface-500 mt-1">
          Complete log of conducted sessions for {getSemesterLabel(user.semester)}
        </p>
      </div>

      {/* Filter Options */}
      <div className="flex gap-4">
        <div className="flex-1 max-w-xs">
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            className="select"
          >
            <option value="">All Subjects</option>
            {subjectsList.map((subj, i) => (
              <option key={i} value={subj}>{subj}</option>
            ))}
          </select>
        </div>
      </div>

      {/* History Feed */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Subject Name</th>
                <th>Class Date & Time</th>
                <th>Status</th>
                <th>Marked At</th>
                <th>GPS Check-in Coordinates</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-surface-500">
                      <div className="w-5 h-5 border-2 border-surface-300 border-t-primary-500 rounded-full animate-spin" />
                      Loading Logs...
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-surface-400">
                    No logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <span className="font-semibold text-surface-900">{log.subject}</span>
                    </td>
                    <td className="text-xs">{formatDateTime(log.sessionDate)}</td>
                    <td>
                      <span className={`badge ${log.present ? 'badge-success' : 'badge-danger'}`}>
                        {log.present ? 'Present' : 'Absent'}
                      </span>
                    </td>
                    <td className="text-xs">
                      {log.markedAt ? formatDateTime(log.markedAt) : '-'}
                    </td>
                    <td>
                      {log.present && log.latitude ? (
                        <div className="flex items-center gap-1 text-[10px] text-surface-500 font-mono">
                          <MapPin size={12} className="text-primary-500" />
                          <span>{log.latitude.toString().slice(0, 8)}, {log.longitude.toString().slice(0, 8)}</span>
                          {log.distance !== null && (
                            <span className="text-[9px] text-accent-600 bg-accent-50 px-1 rounded">({Math.round(log.distance)}m)</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-surface-400">-</span>
                      )}
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
