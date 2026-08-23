import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Scanner } from '@yudiel/react-qr-scanner';
import { isExpired, formatTime } from '../../lib/utils';
import { COLLEGE_RADIUS_METERS, MAX_GPS_ACCURACY_METERS, MAX_ATTENDANCE_DISTANCE_METERS } from '../../lib/constants';
import {
  ScanLine, MapPin, CheckCircle2, XCircle, ArrowLeft,
  Camera, Shield, Sparkles, Radio, Keyboard, Clock, Building2, User
} from 'lucide-react';

export default function ScanAttendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // idle, validating-token, session-found, checking-location, face-verification, marking, success, error
  const [status, setStatus] = useState('idle');
  const [manualToken, setManualToken] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [locationDist, setLocationDist] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [pendingLocation, setPendingLocation] = useState(null); // { lat, lng, accuracy }

  const validateToken = async (rawToken) => {
    if (!rawToken || !rawToken.trim()) return;
    
    // Support both raw token strings and old JSON payloads
    let token = rawToken.trim();
    try {
      const parsed = JSON.parse(token);
      if (parsed.token) token = parsed.token;
    } catch {
      // It's just a raw string, which is fine
    }

    setStatus('validating-token');
    setErrorMsg('');

    try {
      // Fetch session by token
      const { data: session, error: sessionErr } = await supabase
        .from('sessions')
        .select(`
          id, qr_token, status, expires_at, subject_name, department, year, semester, attendance_type, session_type,
          teacher:teacher_id(name)
        `)
        .eq('qr_token', token)
        .single();

      if (sessionErr || !session) throw new Error('Invalid attendance token.');
      if (session.status !== 'active') throw new Error('This attendance session is no longer active.');
      if (isExpired(session.expires_at)) throw new Error('This attendance token has expired.');

      if (
        session.department !== user.department ||
        session.year !== user.year ||
        session.semester !== user.semester
      ) {
        throw new Error(`This session is for ${session.department} (Y${session.year} S${session.semester}). You are in ${user.department} (Y${user.year} S${user.semester}).`);
      }

      // Check duplicate
      const { data: existingMark } = await supabase
        .from('attendance')
        .select('id')
        .eq('session_id', session.id)
        .eq('student_id', user.id)
        .single();

      if (existingMark) {
        throw new Error('Attendance has already been marked for this session.');
      }



      setSessionData(session);
      setStatus('session-found');

    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'Failed to validate token.');
    }
  };

  const handleScan = (detectedCodes) => {
    if (status !== 'idle') return;
    if (detectedCodes && detectedCodes.length > 0) {
      validateToken(detectedCodes[0].rawValue);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (status !== 'idle') return;
    validateToken(manualToken);
  };

  const handleMarkAttendance = () => {

    if (!('geolocation' in navigator)) {
      setStatus('error');
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setStatus('checking-location');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGpsAccuracy(accuracy);

        if (accuracy > MAX_GPS_ACCURACY_METERS) {
          setStatus('error');
          setErrorMsg(`📍 GPS accuracy is too low (${Math.round(accuracy)}m). Please enable precise location and try again.`);
          return;
        }

        setPendingLocation({ lat: latitude, lng: longitude, accuracy });
        handleAttendanceSubmit({ lat: latitude, lng: longitude, accuracy });
      },
      (err) => {
        setStatus('error');
        if (err.code === 1) setErrorMsg('📍 Location permission required. Please allow location access to mark attendance.');
        else if (err.code === 2) setErrorMsg('Unable to detect your location. Please try again.');
        else setErrorMsg('Location request timed out. Please try again.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleAttendanceSubmit = async (location) => {
    if (!location || !sessionData) return;
    try {
      // Single secure server-side call: validates token, expiry, student's own
      // department/year/semester, GPS radius, and duplicate marking —
      // all inside one SECURITY DEFINER function so nothing can be spoofed
      // by tampering with intermediate client state.
      const { data: rpcData, error: markErr } = await supabase.rpc('mark_attendance', {
        p_session_id: sessionData.id,
        p_student_id: user.id,
        p_token: sessionData.qr_token,
        p_lat: location.lat,
        p_lng: location.lng,
        p_accuracy: location.accuracy,
      });

      if (markErr) throw markErr;
      if (rpcData && !rpcData.success) throw new Error(rpcData.message);

      setLocationDist(rpcData?.distance || 0);
      setStatus('success');
      const displaySubject = sessionData.attendance_type === 'daily' 
        ? `Daily Attendance - ${sessionData.session_type === 'morning' ? 'Morning' : 'Afternoon'}` 
        : sessionData.subject_name;
      toast.success(`Attendance marked for ${displaySubject}`);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Verification failed. Attendance was not marked.');
    }
  };

  const resetFlow = () => {
    setStatus('idle');
    setErrorMsg('');
    setSessionData(null);
    setLocationDist(null);
    setGpsAccuracy(null);
    setManualToken('');
    setPendingLocation(null);
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 page-enter min-h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/student')}
          className="p-2.5 rounded-2xl bg-white shadow-sm border border-surface-200 text-surface-600 hover:text-primary-600 hover:border-primary-200 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-black text-surface-900 tracking-tight">
            Scan Attendance
          </h1>
          <p className="text-xs sm:text-sm font-bold text-surface-500 mt-0.5">
            GPS verified attendance
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        
        {/* IDLE — QR Scanner and Manual Entry */}
        {status === 'idle' && (
          <div className="w-full space-y-6">
            
            {/* Camera Scanner */}
            <div className="card p-6 border border-surface-200 shadow-sm space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-black text-surface-900 flex items-center gap-2">
                  <Camera size={16} className="text-primary-500" />
                  Scan Attendance QR
                </h2>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-[10px] font-black uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </div>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-surface-900 border-2 border-surface-200">
                <Scanner 
                  onScan={handleScan} 
                  onError={(err) => setCameraError('Camera unavailable or permission denied. Please allow camera access or enter the token manually.')}
                  scanDelay={1000}
                  components={{ tracker: true }}
                  styles={{
                    container: { width: '100%', aspectRatio: '1/1' },
                  }}
                />
                
                {/* Scanner Overlay UI */}
                <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]" />
                <div className="absolute inset-8 sm:inset-12 pointer-events-none z-20">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-400 rounded-br-lg" />
                </div>
                
                {cameraError && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-surface-900/95 p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-surface-800 flex items-center justify-center text-surface-400 mb-3">
                      <Camera size={24} />
                    </div>
                    <p className="text-sm font-bold text-white max-w-[200px] mb-4">{cameraError}</p>
                    <button 
                      onClick={() => setCameraError('')}
                      className="px-4 py-2 bg-surface-800 text-white border border-surface-700 text-xs font-bold rounded-lg hover:bg-surface-700 transition"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
              <p className="text-center text-[11px] font-bold text-surface-500 flex items-center justify-center gap-1.5">
                <ScanLine size={14} className="text-primary-400" />
                Point camera at teacher&apos;s screen
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-surface-200" />
              <span className="text-xs font-black text-surface-400 uppercase tracking-widest">OR</span>
              <div className="h-px flex-1 bg-surface-200" />
            </div>

            {/* Manual Token Entry */}
            <div className="card p-6 border border-surface-200 shadow-sm">
              <h2 className="text-sm font-black text-surface-900 flex items-center gap-2 mb-4">
                <Keyboard size={16} className="text-primary-500" />
                Enter attendance token manually
              </h2>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value.toUpperCase())}
                  placeholder="e.g. K7P9XA"
                  className="input font-mono text-center tracking-widest uppercase !text-lg flex-1"
                  maxLength={10}
                  required
                />
                <button type="submit" className="btn-primary whitespace-nowrap px-6">
                  Verify Token
                </button>
              </form>
            </div>

            {/* Info chips */}
            <div className="grid grid-cols-2 gap-3 pb-8">
              <div className="card flex items-center gap-3 p-3.5 border border-primary-100">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-primary-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-surface-500">Security</p>
                  <p className="text-[11px] font-bold text-surface-800 truncate">Token + GPS</p>
                </div>
              </div>
              <div className="card flex items-center gap-3 p-3.5 border border-emerald-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Radio size={18} className="text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-surface-500">Radius</p>
                  <p className="text-[11px] font-bold text-surface-800 truncate">Within {MAX_ATTENDANCE_DISTANCE_METERS}m of teacher</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Validating Token */}
        {status === 'validating-token' && (
          <div className="w-full card p-10 flex flex-col items-center text-center border border-primary-100 shadow-lg">
            <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin mb-4" />
            <h2 className="text-xl font-black text-surface-900">Verifying token...</h2>
            <p className="text-sm font-bold text-surface-500 mt-2">Checking session status securely</p>
          </div>
        )}

        {/* Session Found (Confirmation) */}
        {status === 'session-found' && sessionData && (
          <div className="w-full card border border-primary-200 shadow-lg overflow-hidden animate-scale-in">
            <div className="bg-primary-50 p-6 border-b border-primary-100 text-center relative">
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-primary-700 text-[10px] font-black uppercase tracking-wide shadow-sm border border-primary-100">
                <CheckCircle2 size={12} className="text-emerald-500" /> Valid
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto mb-4 border border-primary-100">
                <Sparkles size={28} className="text-primary-500" />
              </div>
              <h2 className="text-2xl font-black text-surface-900 leading-tight">Attendance Session</h2>
              <p className="text-xs font-bold text-surface-500 mt-1">Ready for GPS verification</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-surface-500 shrink-0">
                  <Building2 size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-surface-500">Subject</p>
                  <p className="text-sm font-bold text-surface-900">{sessionData.attendance_type === 'daily' ? `Daily Attendance - ${sessionData.session_type === 'morning' ? 'Morning' : 'Afternoon'}` : sessionData.subject_name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-surface-500 shrink-0">
                  <User size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-surface-500">Teacher / Class</p>
                  <p className="text-sm font-bold text-surface-900">{sessionData.teacher?.name || 'Faculty'} · Y{sessionData.year} S{sessionData.semester}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-danger-50 flex items-center justify-center text-danger-500 shrink-0">
                  <Clock size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-surface-500">Expires At</p>
                  <p className="text-sm font-bold text-surface-900">{formatTime(sessionData.expires_at)}</p>
                </div>
              </div>



              <div className="pt-4 mt-2 border-t border-surface-100">
                <button
                  onClick={handleMarkAttendance}
                  className="btn-primary w-full justify-center py-3.5 text-sm disabled:opacity-50"
                >
                  <MapPin size={16} /> Verify Location & Mark
                </button>
                <button onClick={resetFlow} className="w-full text-center py-3 text-xs font-bold text-surface-500 hover:text-surface-900 transition mt-1">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Checking location */}
        {status === 'checking-location' && (
          <div className="w-full card p-10 flex flex-col items-center text-center border border-primary-100 shadow-lg">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin size={28} className="text-primary-600" />
              </div>
            </div>
            <h2 className="text-xl font-black text-surface-900">Checking your location...</h2>
            <p className="text-sm font-bold text-surface-500 mt-2 max-w-[240px]">
              Verifying you are within {MAX_ATTENDANCE_DISTANCE_METERS}m of your teacher
            </p>
          </div>
        )}



        {/* Success */}
        {status === 'success' && sessionData && (
          <div className="w-full card border border-emerald-200 shadow-lg overflow-hidden animate-scale-in">
            <div className="bg-emerald-500 p-8 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
              <div className="w-20 h-20 rounded-full bg-white text-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-[0_10px_25px_rgba(0,0,0,0.15)] relative z-10">
                <CheckCircle2 size={40} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black relative z-10">Attendance Marked Successfully!</h2>
            </div>
            
            <div className="p-6 text-center space-y-4">
              <div>
                <p className="text-sm font-black text-surface-900">{sessionData.attendance_type === 'daily' ? `Daily Attendance - ${sessionData.session_type === 'morning' ? 'Morning' : 'Afternoon'}` : sessionData.subject_name}</p>
                <p className="text-xs font-bold text-surface-500 mt-0.5">Y{sessionData.year} S{sessionData.semester} · {sessionData.department}</p>
              </div>

              <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 flex flex-col gap-2 text-left">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-surface-500 flex items-center gap-1.5"><MapPin size={12} /> Location</span>
                  <span className="font-black text-emerald-600">Verified ✓</span>
                </div>
                {locationDist !== null && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-surface-500 flex items-center gap-1.5"><Radio size={12} /> Distance</span>
                    <span className="font-black text-surface-900">{Math.round(locationDist)} meters</span>
                  </div>
                )}
                {gpsAccuracy !== null && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-surface-500 flex items-center gap-1.5"><ScanLine size={12} /> GPS Accuracy</span>
                    <span className="font-black text-surface-900">{Math.round(gpsAccuracy)} meters</span>
                  </div>
                )}
              </div>

              <button onClick={() => navigate('/student')} className="btn-primary w-full justify-center py-3.5 mt-2">
                Return to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="w-full card p-8 flex flex-col items-center text-center border border-danger-100 shadow-lg">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white flex items-center justify-center mb-6 shadow-[0_12px_30px_rgba(239,68,68,0.35)]">
              <XCircle size={48} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-surface-900">Verification Failed</h2>
            <p className="text-sm font-bold text-danger-700 mt-3 mb-6 bg-danger-50 px-4 py-3 rounded-2xl border border-danger-100 w-full">
              {errorMsg}
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => navigate('/student')} className="btn-secondary flex-1 justify-center py-3 text-xs">
                Cancel
              </button>
              <button onClick={resetFlow} className="btn-primary flex-1 justify-center py-3 text-xs">
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
