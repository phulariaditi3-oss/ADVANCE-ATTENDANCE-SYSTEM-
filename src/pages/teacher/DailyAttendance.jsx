import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { YEARS, SEMESTER_TYPES, getSemesterFromYearAndType, getDeptLabel, TOKEN_EXPIRY_MINUTES, MAX_ATTENDANCE_DISTANCE_METERS } from '../../lib/constants';
import { useToast } from '../../contexts/ToastContext';
import { QRCodeSVG } from 'qrcode.react';
import { generateSecureToken, getExpiryTimestamp, getRemainingTime, formatTime } from '../../lib/utils';
import { Play, Square, Users, Clock, ShieldAlert, QrCode, MapPin, Loader2, Sun, Sunset } from 'lucide-react';

const SESSIONS = [
  { value: 'morning',   label: 'Morning',   icon: Sun },
  { value: 'afternoon', label: 'Afternoon', icon: Sunset },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function DailyAttendance() {
  const { user } = useAuth();
  const toast = useToast();

  const teachingDepartments = useMemo(
    () => (user?.teachingDepartments?.length ? user.teachingDepartments : [user?.department].filter(Boolean)),
    [user]
  );

  const [department, setDepartment] = useState(teachingDepartments[0] || '');
  const [year, setYear] = useState('');
  const [semType, setSemType] = useState('');

  const [date, setDate] = useState(todayISO());
  const [sessionType, setSessionType] = useState('morning');

  const semester = year && semType ? getSemesterFromYearAndType(year, semType) : null;

  // Session state
  const [session, setSession] = useState(null);
  const [qrValue, setQrValue] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(600);
  const [presentStudents, setPresentStudents] = useState([]);
  const [allClassStudents, setAllClassStudents] = useState([]);
  const [locatingTeacher, setLocatingTeacher] = useState(false);
  const timerRef = useRef(null);

  const getTeacherLocation = () => new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        resolve({ lat: latitude, lng: longitude, accuracy });
      },
      (err) => {
        if (err.code === 1) reject(new Error('Please enable location permission to start a session.'));
        else if (err.code === 2) reject(new Error('Unable to get your current location. Please check your GPS and try again.'));
        else reject(new Error('Location request timed out. Please try again.'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!department || !year || !semType || !date || !sessionType) {
      toast.warning('Please fill all fields.');
      return;
    }

    const token = generateSecureToken(6);
    const expiresAt = getExpiryTimestamp(TOKEN_EXPIRY_MINUTES);

    let teacherLocation;
    setLocatingTeacher(true);
    try {
      teacherLocation = await getTeacherLocation();
    } catch (locErr) {
      setLocatingTeacher(false);
      toast.error(locErr.message);
      return;
    }
    setLocatingTeacher(false);

    try {
      const { data: rpcData, error: sessionErr } = await supabase.rpc('create_attendance_session', {
        p_teacher_id: user.id,
        p_department: department,
        p_year: parseInt(year),
        p_semester: parseInt(semester),
        p_subject_id: null,
        p_subject_name: null,
        p_qr_token: token,
        p_expires_at: expiresAt,
        p_teacher_lat: teacherLocation.lat,
        p_teacher_lng: teacherLocation.lng,
        p_teacher_accuracy: teacherLocation.accuracy,
        p_radius_meters: MAX_ATTENDANCE_DISTANCE_METERS,
        p_attendance_type: 'daily',
        p_session_type: sessionType,
        p_session_date: date
      });

      if (sessionErr) throw sessionErr;
      if (rpcData && rpcData.success === false) {
        toast.error(rpcData.message || 'Error creating daily attendance session.');
        return;
      }

      const newSession = rpcData.session;
      setSession(newSession);

      const qrPayload = JSON.stringify({
        token: newSession.qr_token,
        sessionId: newSession.id,
        department: newSession.department,
        year: newSession.year,
        semester: newSession.semester,
        attendanceType: 'daily',
        sessionType: newSession.session_type
      });
      setQrValue(qrPayload);

      // We won't filter purely by division here for students since division might not be on the student record in some setups,
      // but if it is, we could. We'll fetch all students for the year/sem.
      const { data: classSt } = await supabase
        .from('students')
        .select('id, name, roll_no, enrollment_no, gender')
        .eq('department', department)
        .eq('year', parseInt(year))
        .eq('semester', parseInt(semester))
        .order('roll_no');
      setAllClassStudents(classSt || []);
      setPresentStudents([]);

      toast.success('Daily Attendance session started!');
    } catch (err) {
      toast.error('Failed to start session.');
      console.error(err);
    }
  };

  useEffect(() => {
    if (!session) return;

    timerRef.current = setInterval(() => {
      const remaining = getRemainingTime(session.expires_at);
      setTimeLeft(remaining);

      const diffMs = new Date(session.expires_at) - new Date();
      const secs = Math.max(0, Math.floor(diffMs / 1000));
      setSecondsRemaining(secs);

      if (remaining === 'Expired' || secs <= 0) {
        handleExpireSession();
      }
    }, 1000);

    fetchPresentStudents();

    const subscription = supabase
      .channel(`daily_attendance_session_${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance',
        filter: `session_id=eq.${session.id}`
      }, () => {
        fetchPresentStudents();
      })
      .subscribe();

    return () => {
      clearInterval(timerRef.current);
      supabase.removeChannel(subscription);
    };
  }, [session]);

  const fetchPresentStudents = async () => {
    if (!session) return;
    const { data } = await supabase
      .from('attendance')
      .select('student:student_id(id, name, roll_no, enrollment_no, gender)')
      .eq('session_id', session.id);

    if (data) {
      const sorted = data
        .map(a => a.student)
        .filter(Boolean)
        .sort((a, b) => a.roll_no - b.roll_no);
      setPresentStudents(sorted);

      await supabase
        .from('sessions')
        .update({ total_present: sorted.length })
        .eq('id', session.id);
    }
  };

  const handleExpireSession = async () => {
    if (!session) return;
    clearInterval(timerRef.current);

    await supabase
      .from('sessions')
      .update({ status: 'expired' })
      .eq('id', session.id);

    setSession(prev => prev ? { ...prev, status: 'expired' } : null);
    toast.info('QR Code has expired.');
  };

  const handleCloseSession = async () => {
    if (!session) return;
    clearInterval(timerRef.current);

    try {
      await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', session.id);

      toast.success('Attendance session closed.');
      setSession(null);
    } catch (err) {
      toast.error('Failed to close session.');
    }
  };

  const isUnderOneMin = secondsRemaining > 0 && secondsRemaining < 60;

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 tracking-tight">Daily Attendance</h1>
          <p className="text-sm font-bold text-surface-600 mt-1">
            Generate QR for Daily Morning/Afternoon Attendance
          </p>
        </div>
      </div>

      {!session ? (
        <div className="card p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
          <h2 className="text-xl font-black text-surface-900 flex items-center gap-2">
            <Play size={20} className="text-primary-500" />
            Session Setup
          </h2>
          
          <form onSubmit={handleStartSession} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Department</label>
                <select
                  value={department}
                  onChange={e => { setDepartment(e.target.value); setYear(''); setSemType(''); }}
                  className="select"
                  required
                >
                  {teachingDepartments.length === 0 && <option value="">No departments assigned</option>}
                  {teachingDepartments.map(code => (
                    <option key={code} value={code}>{getDeptLabel(code)}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Year</label>
                <select
                  value={year}
                  onChange={e => { setYear(e.target.value); setSemType(''); }}
                  className="select"
                  disabled={!department}
                  required
                >
                  <option value="">Select</option>
                  {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Semester Type</label>
                <select
                  value={semType}
                  onChange={e => setSemType(e.target.value)}
                  className="select"
                  disabled={!year}
                  required
                >
                  <option value="">Select</option>
                  {SEMESTER_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="label">Session</label>
                <div className="grid grid-cols-2 gap-2">
                  {SESSIONS.map(s => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSessionType(s.value)}
                        className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 border-2 transition-all font-bold text-sm ${
                          sessionType === s.value 
                            ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm' 
                            : 'border-surface-200 bg-white text-surface-600 hover:bg-surface-50'
                        }`}
                      >
                        <Icon size={16} className={sessionType === s.value ? 'text-primary-500' : ''} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={teachingDepartments.length === 0 || locatingTeacher || !semester}
              className="btn-primary w-full justify-center py-3 text-sm font-black tracking-widest uppercase mt-4 shadow-[0_5px_15px_rgba(217,70,239,0.4)] disabled:opacity-50"
            >
              {locatingTeacher ? (
                <><Loader2 size={18} className="animate-spin" /> GETTING YOUR LOCATION...</>
              ) : (
                <><QrCode size={18} /> GENERATE QR</>
              )}
            </button>
            <p className="text-[11px] font-bold text-surface-400 text-center flex items-center justify-center gap-1.5">
              <MapPin size={12} /> Students must be within {MAX_ATTENDANCE_DISTANCE_METERS}m of your current location to mark attendance
            </p>
          </form>
        </div>
      ) : (
        /* Live QR Code Display Screen */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-scale-in">
          
          <div className="card p-6 flex flex-col items-center text-center lg:col-span-1 shadow-[4px_4px_15px_rgba(175,100,223,0.3),-4px_-4px_15px_rgba(255,255,255,0.9)] border-2 border-primary-500/20">
            
            <div className="w-full bg-surface-50 shadow-inner p-4 rounded-xl mb-6">
              <span className="text-[10px] font-black uppercase tracking-wider text-white bg-primary-500 px-2 py-0.5 rounded-full shadow-sm mb-2 inline-block">
                Active Daily Session
              </span>
              <h2 className="text-lg font-black text-surface-900 leading-tight">
                Daily Attendance - {session.session_type === 'morning' ? 'Morning' : 'Afternoon'}
              </h2>
              <p className="text-[10px] text-surface-600 font-bold mt-1">
                {formatTime(session.created_at)} – {formatTime(session.expires_at)}
              </p>
              <div className="mt-3 py-2 px-4 bg-white rounded-lg border border-surface-200 inline-block shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wider text-surface-500 mb-0.5">Attendance Token</p>
                <p className="text-xl font-black font-mono text-primary-600 tracking-widest">{session.qr_token}</p>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05),inset_-4px_-4px_8px_rgba(255,255,255,0.8)] mb-6 inline-block">
              {session.status === 'active' ? (
                <QRCodeSVG value={qrValue} size={200} level="M" includeMargin={true} />
              ) : (
                <div className="w-[200px] h-[200px] flex flex-col items-center justify-center border border-dashed border-surface-200 rounded-xl text-danger-500">
                  <ShieldAlert size={40} className="mb-2" />
                  <p className="text-sm font-black">Expired</p>
                </div>
              )}
            </div>

            <div className={`w-full p-3 rounded-xl mb-6 shadow-inner transition-colors flex items-center justify-center gap-3 ${
              isUnderOneMin ? 'bg-danger-500/20 text-danger-800 animate-pulse' : 'bg-white/40 text-surface-700'
            }`}>
              <Clock size={20} />
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-wider opacity-80">
                  {isUnderOneMin ? 'Expiring!' : 'Countdown'}
                </p>
                <p className="text-2xl font-black font-mono leading-none tracking-tight">{timeLeft || '00:00'}</p>
              </div>
            </div>

            <button onClick={handleCloseSession} className="btn-danger w-full justify-center py-2.5">
              <Square size={16} /> Close Session
            </button>
          </div>

          <div className="card p-6 lg:col-span-2 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-surface-200/50 mb-4">
              <h3 className="text-lg font-black text-surface-900 flex items-center gap-2">
                <Users className="text-primary-500" size={20} />
                Live Feed
              </h3>
              <div className="px-3 py-1 rounded-full bg-accent-500 text-white text-xs font-black shadow-sm">
                {presentStudents.length} / {allClassStudents.length} Present
              </div>
            </div>

            {presentStudents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 border-[5px] border-white border-t-primary-500 rounded-full animate-spin shadow-md mb-4" />
                <p className="text-sm font-black text-surface-700">Waiting for Scans...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[380px] custom-scrollbar pr-2 space-y-2">
                {presentStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-white/40 hover:bg-white/60 transition-colors shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-black shadow-inner">
                        {student.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-black text-surface-900">{student.name}</p>
                        <p className="text-[10px] font-bold text-surface-600 font-mono">
                          Roll #{student.roll_no} • {student.enrollment_no}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-accent-500 font-black text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Present
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
