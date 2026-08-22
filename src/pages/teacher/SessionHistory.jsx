import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { History, Calendar, Download, QrCode } from 'lucide-react';
import { formatTime } from '../../lib/utils';
import { Link } from 'react-router-dom';

export default function SessionHistory() {
  const { user, role } = useAuth();
  // HODs viewing this page live under /hod/*, teachers under /teacher/* —
  // keep in-page links pointed at whichever base the user is actually on.
  const basePath = role === 'hod' ? '/hod' : '/teacher';
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchSessions();
  }, [user]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 tracking-tight">Session History</h1>
          <p className="text-sm font-bold text-surface-600 mt-1">View all attendance sessions you have conducted</p>
        </div>
        <Link to={`${basePath}/take-attendance`} className="btn-primary self-start sm:self-auto shadow-md">
          <QrCode size={16} /> New Session
        </Link>
      </div>

      <div className="card p-5">
        {loading ? <LoadingSkeleton /> : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Class Info</th>
                  <th>Date & Time</th>
                  <th>Attendance</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-surface-600 font-bold">
                      No sessions found.
                    </td>
                  </tr>
                ) : (
                  sessions.map(session => (
                    <tr key={session.id}>
                      <td>
                        <p className="font-black text-surface-900">{session.subject_name}</p>
                        <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-black tracking-wider uppercase ${
                          session.status === 'active' ? 'bg-accent-500 text-white' : 'bg-surface-200 text-surface-900'
                        }`}>
                          {session.status}
                        </span>
                      </td>
                      <td>
                        <p className="text-xs font-bold text-surface-700">{session.department}</p>
                        <p className="text-[10px] text-surface-600 font-bold uppercase tracking-wider">Y{session.year} · Sem {session.semester}</p>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-surface-700">
                          <Calendar size={13} className="text-primary-500"/> 
                          {new Date(session.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <p className="text-[10px] text-surface-600 font-bold uppercase tracking-wider mt-0.5 ml-5">
                          {formatTime(session.created_at)}
                        </p>
                      </td>
                      <td>
                        <span className="badge badge-success px-3 py-1 shadow-sm">
                          {session.total_present} Present
                        </span>
                      </td>
                      <td className="text-right">
                        <Link to={`${basePath}/reports`} className="btn-secondary text-xs px-3 py-1.5 shadow-sm inline-flex">
                          <Download size={14} /> Report
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
