import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import FaceCapture from '../../components/FaceCapture';
import { ArrowLeft, ScanFace, CheckCircle2, ShieldCheck, RefreshCw, Trash2 } from 'lucide-react';

export default function FaceRegistration() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [status, setStatus] = useState('loading'); // loading, not-registered, registered, capturing, saving
  const [updatedAt, setUpdatedAt] = useState(null);
  const [reRegister, setReRegister] = useState(false);

  useEffect(() => {
    if (user?.id) fetchStatus();
  }, [user]);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('face_registration_status', { p_student_id: user.id });
      if (error) throw error;
      if (data?.registered) {
        setStatus('registered');
        setUpdatedAt(data.updated_at);
      } else {
        setStatus('not-registered');
      }
    } catch (err) {
      toast.error('Could not check face registration status.');
      setStatus('not-registered');
    }
  };

  const handleCapture = async (descriptor) => {
    setStatus('saving');
    try {
      const { data, error } = await supabase.rpc('register_face', {
        p_student_id: user.id,
        p_descriptor: descriptor,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Registration failed.');

      toast.success('Face registered successfully!');
      setReRegister(false);
      fetchStatus();
    } catch (err) {
      toast.error(err.message || 'Failed to register face.');
      setStatus('capturing');
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove your registered face? You will need to register again before you can scan attendance.')) return;
    try {
      const { error } = await supabase.rpc('delete_face_profile', { p_student_id: user.id });
      if (error) throw error;
      toast.success('Face profile removed.');
      setStatus('not-registered');
    } catch (err) {
      toast.error('Failed to remove face profile.');
    }
  };

  const showCapture = status === 'not-registered' || status === 'capturing' || reRegister;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 page-enter">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/student')}
          className="p-2.5 rounded-2xl bg-white shadow-sm border border-surface-200 text-surface-600 hover:text-primary-600 hover:border-primary-200 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-surface-900 tracking-tight">Face Recognition</h1>
          <p className="text-xs sm:text-sm font-bold text-surface-500 mt-0.5">Used to verify it's really you when marking attendance</p>
        </div>
      </div>

      <div className="card p-6 sm:p-8 space-y-6">
        {status === 'loading' && (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-4 border-surface-200 border-t-primary-500 rounded-full animate-spin" />
          </div>
        )}

        {status === 'registered' && !reRegister && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <ShieldCheck size={36} />
            </div>
            <div>
              <p className="text-lg font-black text-surface-900 flex items-center justify-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" /> Registered
              </p>
              {updatedAt && (
                <p className="text-xs font-bold text-surface-500 mt-1">
                  Last updated {new Date(updatedAt).toLocaleString('en-IN')}
                </p>
              )}
            </div>
            <p className="text-xs font-medium text-surface-500 max-w-xs">
              Your face is registered and will be checked every time you scan a QR to mark attendance.
              Only you can verify against your own face.
            </p>
            <div className="flex gap-3 w-full pt-2">
              <button onClick={() => setReRegister(true)} className="btn-secondary flex-1 justify-center">
                <RefreshCw size={15} /> Re-register
              </button>
              <button onClick={handleRemove} className="btn-danger flex-1 justify-center">
                <Trash2 size={15} /> Remove
              </button>
            </div>
          </div>
        )}

        {showCapture && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-500">
              <ScanFace size={30} />
            </div>
            <p className="text-sm font-black text-surface-900 text-center">
              {reRegister ? 'Capture a new face image' : 'Status: Not Registered'}
            </p>
            <FaceCapture
              busy={status === 'saving'}
              onCapture={handleCapture}
              instruction="Look directly at the camera in good lighting. Only your face will be used to generate a secure verification code — the image itself is never stored."
            />
            {reRegister && (
              <button onClick={() => setReRegister(false)} className="text-xs font-bold text-surface-500 hover:text-surface-800">
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-surface-400 font-medium text-center mt-4 px-4">
        By registering, you consent to SSPI storing a mathematical representation of your face
        (not a photo) to verify your identity during attendance. Contact admin to have this data removed at any time.
      </p>
    </div>
  );
}
