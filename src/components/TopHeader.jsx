import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

export default function TopHeader() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-end gap-3 px-4 sm:px-6 lg:px-8 h-16 bg-surface-50/85 backdrop-blur-md border-b border-surface-200/70 -mx-4 sm:-mx-6 lg:-mx-8 mb-6">
        <div className="flex items-center gap-2.5 pl-3 pr-4 py-1.5 rounded-xl bg-white border border-surface-200/70">
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-xs font-black text-white shrink-0">
            {user?.name?.[0] || 'U'}
          </div>
          <div className="leading-tight hidden sm:block">
            <p className="text-sm font-bold text-surface-900">{user?.name || 'User'}</p>
            <p className="text-[11px] text-surface-500 font-semibold capitalize">
              {role === 'hod' ? 'HOD' : role === 'staff' ? 'Teacher' : role}
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfirmLogout(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold text-danger-600 border border-danger-100 bg-danger-50 hover:text-white hover:bg-danger-500 hover:border-danger-500 transition-colors"
          title="Sign out"
        >
          <LogOut size={17} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </header>

      <AnimatePresence>
        {confirmLogout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setConfirmLogout(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ duration: 0.2 }}
              className="modal-content !bg-white text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-danger-50 flex items-center justify-center mx-auto mb-4">
                <LogOut size={24} className="text-danger-500" />
              </div>
              <h3 className="text-lg font-black text-surface-900">Sign out?</h3>
              <p className="text-sm text-surface-500 font-medium mt-1.5 mb-6">
                You'll need to sign in again to access your dashboard.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmLogout(false)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button onClick={handleLogout} className="btn-danger flex-1 justify-center !py-2.5">
                  Sign Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
