import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.svg';
import { LayoutDashboard, ScanLine, History, LogOut, Menu, X, ScanFace } from 'lucide-react';
import { useState } from 'react';
import { INSTITUTE_SHORT } from '../lib/constants';

const studentLinks = [
  { to: '/student',                  icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/student/scan',             icon: ScanLine,         label: 'Scan QR' },
  { to: '/student/history',          icon: History,          label: 'Attendance' },
  { to: '/student/face-registration',icon: ScanFace,         label: 'Face ID' },
];

export default function StudentNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const isLinkActive = (link) =>
    link.end ? location.pathname === link.to : location.pathname.startsWith(link.to);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <nav className="sticky top-0 z-40 bg-surface-100/90 backdrop-blur-md border-b border-surface-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow-sm p-1.5 shrink-0 flex items-center justify-center">
                <img src={logo} alt="SSPI Logo" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-surface-900 leading-tight truncate">{INSTITUTE_SHORT} Parbhani</p>
                <p className="text-[11px] text-surface-500 font-semibold hidden sm:block leading-tight">Smart QR Attendance</p>
              </div>
            </div>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1 relative">
              {studentLinks.map(link => {
                const active = isLinkActive(link);
                return (
                  <NavLink key={link.to} to={link.to} end={link.end} className="nav-item">
                    {active && (
                      <motion.div
                        layoutId="student-active-pill"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-[14px]"
                        style={{
                          background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                          boxShadow: '0 4px 14px rgba(79, 70, 229, 0.38)',
                        }}
                      />
                    )}
                    <link.icon size={17} className="relative" strokeWidth={2.25} />
                    <span className={`relative ${active ? 'text-white' : ''}`}>{link.label}</span>
                  </NavLink>
                );
              })}
            </div>

            {/* User + Logout */}
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-xl bg-white/70">
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-xs font-black text-white shrink-0">
                  {user?.name?.[0]}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-surface-900">{user?.name}</p>
                  <p className="text-[11px] text-surface-500 font-semibold">Roll #{user?.roll_no}</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmLogout(true)}
                className="p-2.5 rounded-xl text-danger-500 hover:text-white hover:bg-danger-500 transition-colors"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-xl text-surface-700 bg-white/70 transition-colors"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="md:hidden overflow-hidden bg-surface-100 border-t border-surface-200/70"
            >
              <div className="px-4 py-3 space-y-1.5">
                {studentLinks.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? 'active' : 'bg-white/50'}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <div
                            className="absolute inset-0 rounded-[14px]"
                            style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)' }}
                          />
                        )}
                        <link.icon size={18} className="relative" />
                        <span className="relative">{link.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
                <div className="pt-3 mt-2 border-t border-surface-200/70 flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-sm font-black text-white">
                      {user?.name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-surface-900">{user?.name}</p>
                      <p className="text-xs text-surface-500 font-semibold">{user?.enrollment_no}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmLogout(true)}
                    className="p-2.5 bg-white/70 rounded-xl text-danger-500 hover:bg-danger-500 hover:text-white transition-colors"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Logout confirm modal */}
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
