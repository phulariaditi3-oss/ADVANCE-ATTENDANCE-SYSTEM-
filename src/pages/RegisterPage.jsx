import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DEPARTMENTS, YEARS, YEAR_SEMESTERS, INSTITUTE_NAME } from '../lib/constants';
import { isValidEmail, isValidMobile } from '../lib/utils';
import {
  User,
  Mail,
  Lock,
  Phone,
  Hash,
  BookOpen,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Shield,
  CheckCircle,
} from 'lucide-react';

export default function RegisterPage() {
  const { registerStudent } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: '',
    enrollment_no: '',
    roll_no: '',
    gender: 'Male',
    department: '',
    year: '',
    semester: '',
    email: '',
    password: '',
    confirmPassword: '',
    student_mobile: '',
    parent_mobile: '',
  });

  const update = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Auto-adjust semester when year changes
      if (field === 'year' && value) {
        const sems = YEAR_SEMESTERS[parseInt(value)];
        if (sems && !sems.includes(parseInt(prev.semester))) {
          next.semester = sems[0].toString();
        }
      }
      return next;
    });
  };

  const validateStep1 = () => {
    if (!form.name.trim()) return 'Full name is required.';
    if (!form.enrollment_no.trim()) return 'Enrollment number is required.';
    if (!form.roll_no || parseInt(form.roll_no) < 1) return 'Valid roll number is required.';
    if (!form.gender) return 'Gender is required.';
    if (!form.department) return 'Department is required.';
    if (!form.year) return 'Year is required.';
    if (!form.semester) return 'Semester is required.';
    return null;
  };

  const validateStep2 = () => {
    if (!isValidEmail(form.email)) return 'Valid email is required.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    if (!isValidMobile(form.student_mobile)) return 'Valid 10-digit student mobile number is required.';
    if (!isValidMobile(form.parent_mobile)) return 'Valid 10-digit parent mobile number is required.';
    return null;
  };

  const handleNext = () => {
    const error = validateStep1();
    if (error) {
      toast.warning(error);
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validateStep2();
    if (error) {
      toast.warning(error);
      return;
    }

    setLoading(true);
    const result = await registerStudent(form);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      toast.error(result.error);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
        <div className="max-w-md w-full text-center animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-accent-600" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900 mb-2">Registration Successful!</h1>
          <p className="text-surface-500 mb-6">
            Your account has been created. You can now login to access your dashboard.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary mx-auto"
          >
            Go to Login <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  const availableSemesters = form.year ? YEAR_SEMESTERS[parseInt(form.year)] || [] : [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-4 sm:p-6">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900">Student Registration</h1>
          <p className="text-sm text-surface-500 mt-1">{INSTITUTE_NAME}</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-primary-500' : 'bg-surface-200'}`} />
            <p className={`text-xs mt-2 font-medium ${step === 1 ? 'text-primary-600' : 'text-surface-400'}`}>
              Academic Details
            </p>
          </div>
          <div className="flex-1">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-primary-500' : 'bg-surface-200'}`} />
            <p className={`text-xs mt-2 font-medium ${step === 2 ? 'text-primary-600' : 'text-surface-400'}`}>
              Account & Contact
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="card p-6 sm:p-8">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    className="input !pl-12"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Enrollment No.</label>
                  <div className="relative">
                    <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type="text"
                      value={form.enrollment_no}
                      onChange={e => update('enrollment_no', e.target.value)}
                      className="input !pl-12"
                      placeholder="e.g. 2024ME001"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Roll No.</label>
                  <div className="relative">
                    <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type="number"
                      min="1"
                      value={form.roll_no}
                      onChange={e => update('roll_no', e.target.value)}
                      className="input !pl-12"
                      placeholder="e.g. 1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Gender</label>
                <select
                  value={form.gender}
                  onChange={e => update('gender', e.target.value)}
                  className="select"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="label">Department</label>
                <select
                  value={form.department}
                  onChange={e => update('department', e.target.value)}
                  className="select"
                >
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d.value} value={d.value}>{d.label} ({d.value})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Year</label>
                  <select
                    value={form.year}
                    onChange={e => update('year', e.target.value)}
                    className="select"
                  >
                    <option value="">Select Year</option>
                    {YEARS.map(y => (
                      <option key={y.value} value={y.value}>{y.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Semester</label>
                  <select
                    value={form.semester}
                    onChange={e => update('semester', e.target.value)}
                    className="select"
                    disabled={!form.year}
                  >
                    <option value="">Select Semester</option>
                    {availableSemesters.map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="button" onClick={handleNext} className="btn-primary w-full justify-center py-3.5 rounded-2xl active:scale-95 font-bold mt-2">
                Next Step <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    className="input !pl-12"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => update('password', e.target.value)}
                      className="input !pl-12"
                      placeholder="Min 6 chars"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Confirm Password</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={e => update('confirmPassword', e.target.value)}
                      className="input !pl-12"
                      placeholder="Re-enter"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-stone-500">
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="flex items-center gap-1 hover:text-stone-700 transition font-bold">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showPassword ? 'Hide' : 'Show'} passwords
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Student Mobile</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type="tel"
                      value={form.student_mobile}
                      onChange={e => update('student_mobile', e.target.value)}
                      className="input !pl-12"
                      placeholder="10-digit number"
                      maxLength={10}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Parent Mobile</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type="tel"
                      value={form.parent_mobile}
                      onChange={e => update('parent_mobile', e.target.value)}
                      className="input !pl-12"
                      placeholder="10-digit number"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 justify-center">
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-3">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Register <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Login link */}
        <p className="text-center text-sm text-surface-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700 transition-colors">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
