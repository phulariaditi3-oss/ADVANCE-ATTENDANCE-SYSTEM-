import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import confetti from 'canvas-confetti';
import { INSTITUTE_NAME, INSTITUTE_LOCATION, APP_NAME } from '../lib/constants';
import logo from '../assets/logo.svg';
import {
  Shield, GraduationCap, Users, Lock, Mail, Eye, EyeOff,
  ArrowRight, ChevronLeft, Search, QrCode, BarChart3, Bell, Zap, CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const { loginAdmin, loginStaff, loginStudent, isAuthenticated, role } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated && !showCelebration) {
      if (role === 'admin') navigate('/admin');
      else if (role === 'hod') navigate('/hod');
      else if (role === 'staff') navigate('/teacher');
      else if (role === 'student') navigate('/student');
    }
  }, [isAuthenticated, role, navigate, showCelebration]);

  const triggerCelebration = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const end = Date.now() + 1500;
    const colors = ['#a78bfa', '#c084fc', '#f472b6', '#38bdf8', '#818cf8'];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
        disableForReducedMotion: true
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
        disableForReducedMotion: true
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  const doCelebrationTransition = (path, msg) => {
    setWelcomeMessage(msg);
    setShowCelebration(true);
    triggerCelebration();
    setTimeout(() => {
      navigate(path);
    }, 2200);
  };

  useEffect(() => {
    if (selectedRole === 'staff') fetchStaffList();
  }, [selectedRole]);

  const fetchStaffList = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, name, department, staff_id, is_active')
      .eq('is_active', true)
      .order('name');
    setStaffList(data || []);
  };

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.department.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.staff_id.toLowerCase().includes(staffSearch.toLowerCase())
  );

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await loginAdmin(adminEmail, adminPassword);
    setLoading(false);
    if (result.success) {
      doCelebrationTransition('/admin', 'Welcome back! 🎉');
    } else {
      toast.error(result.error);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      toast.warning('Please select your name from the list.');
      return;
    }
    setLoading(true);
    const result = await loginStaff(selectedStaff.id, staffEmail, staffPassword);
    setLoading(false);
    if (result.success) {
      doCelebrationTransition(result.role === 'hod' ? '/hod' : '/teacher', `Welcome, ${selectedStaff.name}! 🎉`);
    } else {
      toast.error(result.error);
    }
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await loginStudent(studentEmail, studentPassword);
    setLoading(false);
    if (result.success) {
      doCelebrationTransition('/student', 'Welcome back! 🎉');
    } else {
      toast.error(result.error);
    }
  };

  const featuresList = [
    { icon: QrCode,    title: 'Instant QR Check-In',      desc: 'Secure 10-minute dynamic QR code verification' },
    { icon: BarChart3, title: 'Smart Academic Reports',    desc: 'Roll-number sorted Excel & CSV downloads' },
    { icon: Bell,      title: 'Low Attendance Alarms',     desc: 'Automatic flags for attendance under 75%' },
    { icon: Zap,       title: 'Live Campus Feeds',         desc: 'Real-time session attendance monitoring' },
  ];

  const roles = [
    {
      id: 'admin',
      icon: Shield,
      title: 'Administrator',
      desc: 'Master dashboard, HODs & college config',
      iconBg: 'bg-surface-700',
    },
    {
      id: 'staff',
      icon: Users,
      title: 'Staff / HOD / Teacher',
      desc: 'Teachers take attendance; HODs manage department',
      iconBg: 'bg-primary-500',
    },
    {
      id: 'student',
      icon: GraduationCap,
      title: 'Student',
      desc: 'Scan QR & view personal records',
      iconBg: 'bg-primary-700',
    },
  ];

  return (
    <div className="min-h-screen flex bg-surface-100 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-white/40 blur-[100px] pointer-events-none" />

      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between p-10 xl:p-14 relative z-10 border-r border-white/40 shadow-[10px_0_30px_rgba(175,100,223,0.1)] bg-white/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-[20px] bg-white p-2 shadow-[4px_4px_10px_rgba(175,100,223,0.2),-4px_-4px_10px_rgba(255,255,255,0.6)] flex items-center justify-center shrink-0">
            <img src={logo} alt="SSPI Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-black text-surface-900 leading-tight">{INSTITUTE_NAME}</h1>
            <p className="text-sm text-surface-600 font-bold leading-tight">{INSTITUTE_LOCATION}</p>
          </div>
        </div>

        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="space-y-4"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-surface-50 text-surface-900 border border-white/60 text-[10px] font-black uppercase tracking-widest shadow-sm">
              Official Campus Portal
            </span>
            <h2 className="text-4xl xl:text-5xl font-black text-surface-900 leading-tight tracking-tight drop-shadow-sm">
              Smart QR<br />
              <span className="text-primary-500">Attendance</span><br />
              Management
            </h2>
            <p className="text-sm xl:text-base text-surface-700 leading-relaxed max-w-sm font-bold">
              Streamline attendance with time-bounded QR codes, campus GPS validation, and automated reports.
            </p>
          </motion.div>

          <div className="space-y-4">
            {featuresList.map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-white shadow-[2px_2px_5px_rgba(175,100,223,0.2)] flex items-center justify-center text-primary-500 shrink-0 group-hover:scale-110 transition-transform">
                  <feat.icon size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-surface-900 leading-tight">{feat.title}</p>
                  <p className="text-xs text-surface-600 font-bold leading-tight">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-xs text-surface-500 font-bold">
          © {new Date().getFullYear()} {INSTITUTE_NAME}
        </p>
      </div>

      {/* Right Panel — Login */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 sm:p-10 relative z-10">
        <div className="w-full max-w-md space-y-6">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-[16px] bg-white p-1.5 shadow-[4px_4px_10px_rgba(175,100,223,0.2),-4px_-4px_10px_rgba(255,255,255,0.6)] flex items-center justify-center shrink-0">
              <img src={logo} alt="SSPI Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-black text-surface-900 leading-tight">{INSTITUTE_NAME}</h1>
              <p className="text-[10px] text-surface-600 font-bold">{APP_NAME}</p>
            </div>
          </div>

          <div className="card p-8 relative overflow-hidden">
            {/* Celebration Overlay */}
            <AnimatePresence>
              {showCelebration && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0.8, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="w-20 h-20 rounded-2xl bg-primary-50 text-primary-500 flex items-center justify-center mb-6 shadow-sm border border-primary-100"
                  >
                    <CheckCircle2 size={40} />
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl font-black text-surface-900"
                  >
                    {welcomeMessage}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm font-bold text-surface-500 mt-2"
                  >
                    Taking you to your dashboard...
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Role Selection */}
            {!selectedRole && !showCelebration && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl font-black text-surface-900">Sign In</h2>
                  <p className="text-sm text-surface-600 font-bold mt-1">Select your portal to continue</p>
                </div>

                <div className="space-y-4">
                  {roles.map((r, index) => (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.07 }}
                      onClick={() => setSelectedRole(r.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface-50 border-none shadow-[4px_4px_10px_rgba(175,100,223,0.15),-4px_-4px_10px_rgba(255,255,255,0.8)]
                        hover:shadow-[inset_2px_2px_5px_rgba(175,100,223,0.1),inset_-2px_-2px_5px_rgba(255,255,255,0.8)] transition-all duration-200 group text-left"
                    >
                      <div className={`w-12 h-12 rounded-xl ${r.iconBg} flex items-center justify-center text-white shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                        <r.icon size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-black text-surface-900">{r.title}</p>
                        <p className="text-[11px] text-surface-600 font-bold mt-0.5 leading-tight">{r.desc}</p>
                      </div>
                      <ArrowRight size={18} className="text-primary-700 group-hover:translate-x-1 transition-transform shrink-0" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Back Button */}
            {selectedRole && (
              <button
                onClick={() => {
                  setSelectedRole(null);
                  setSelectedStaff(null);
                  setStaffSearch('');
                }}
                className="flex items-center gap-1.5 text-xs font-black text-surface-500 hover:text-primary-500 transition-colors mb-6 uppercase tracking-wider"
              >
                <ChevronLeft size={16} />
                Back to portals
              </button>
            )}

            {/* Admin Login Form */}
            {selectedRole === 'admin' && (
              <motion.form
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleAdminLogin}
                className="space-y-5"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-surface-700 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Shield size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-surface-900">Admin Portal</h2>
                    <p className="text-xs text-surface-600 font-bold">Sign in with admin email &amp; password</p>
                  </div>
                </div>

                <div>
                  <label className="label">Admin Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      className="input !pl-10"
                      placeholder="admin@sspi.ac.in"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      className="input !pl-10 !pr-10"
                      placeholder="Enter admin password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-900 p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-sm font-black uppercase tracking-wider mt-2">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Access Admin Dashboard <ArrowRight size={18} /></>
                  )}
                </button>
              </motion.form>
            )}

            {/* Staff Login Form */}
            {selectedRole === 'staff' && (
              <motion.form
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleStaffLogin}
                className="space-y-5"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Users size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-surface-900">Staff Portal</h2>
                    <p className="text-xs text-surface-600 font-bold">Select your name to sign in</p>
                  </div>
                </div>

                <div>
                  <label className="label">Select Faculty Name</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                    <input
                      type="text"
                      value={staffSearch}
                      onChange={e => { setStaffSearch(e.target.value); setSelectedStaff(null); }}
                      className="input !pl-10"
                      placeholder="Search name or department..."
                    />
                  </div>
                  {(staffSearch || staffList.length > 0) && !selectedStaff && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white bg-white/80 backdrop-blur shadow-lg divide-y divide-purple-50">
                      {filteredStaff.length === 0 ? (
                        <p className="p-3 text-xs text-surface-600 font-bold text-center">No faculty found</p>
                      ) : (
                        filteredStaff.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setSelectedStaff(s); setStaffSearch(s.name); }}
                            className="w-full flex items-center gap-3 px-3 py-3 hover:bg-primary-100 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-black shrink-0">
                              {s.name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-black text-surface-900">{s.name}</p>
                              <p className="text-[10px] text-surface-600 font-bold">{s.department} · {s.staff_id}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {selectedStaff && (
                    <div className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary-100 border border-primary-200">
                      <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-black shrink-0">
                        {selectedStaff.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-black text-primary-800">{selectedStaff.name}</p>
                        <p className="text-[10px] text-primary-700 font-bold">{selectedStaff.department}</p>
                      </div>
                      <CheckCircle2 size={16} className="text-primary-500 ml-auto" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                    <input
                      type="email"
                      value={staffEmail}
                      onChange={e => setStaffEmail(e.target.value)}
                      className="input !pl-10"
                      placeholder="Registered email address"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={staffPassword}
                      onChange={e => setStaffPassword(e.target.value)}
                      className="input !pl-10 !pr-10"
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-900 p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-sm font-black uppercase tracking-wider mt-2">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Sign In as Staff <ArrowRight size={18} /></>
                  )}
                </button>
              </motion.form>
            )}

            {/* Student Login Form */}
            {selectedRole === 'student' && (
              <motion.form
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleStudentLogin}
                className="space-y-5"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary-700 flex items-center justify-center text-white shrink-0 shadow-md">
                    <GraduationCap size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-surface-900">Student Portal</h2>
                    <p className="text-xs text-surface-600 font-bold">Enter your registered credentials</p>
                  </div>
                </div>

                <div>
                  <label className="label">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                    <input
                      type="email"
                      value={studentEmail}
                      onChange={e => setStudentEmail(e.target.value)}
                      className="input !pl-10"
                      placeholder="Registered email address"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={studentPassword}
                      onChange={e => setStudentPassword(e.target.value)}
                      className="input !pl-10 !pr-10"
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-900 p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-sm font-black uppercase tracking-wider mt-2">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Sign In to Dashboard <ArrowRight size={18} /></>
                  )}
                </button>

                <p className="text-center text-xs text-surface-600 font-bold pt-2">
                  Don&apos;t have an account?{' '}
                  <Link to="/register" className="text-primary-500 font-black hover:underline">
                    Register here
                  </Link>
                </p>
              </motion.form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
