import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.svg';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  QrCode,
  FileBarChart,
  AlertTriangle,
  History,
  Menu,
  X,
  ChevronLeft,
  ClipboardList,
  FileDown,
} from 'lucide-react';

const adminLinks = [
  { to: '/admin',                       icon: LayoutDashboard, label: 'Dashboard',         end: true },
  { to: '/admin/staff',                 icon: Users,           label: 'Manage Staff & HODs' },
  { to: '/admin/students',             icon: GraduationCap,   label: 'View Students' },
  { to: '/admin/daily-attendance',     icon: ClipboardList,   label: 'Daily Attendance' },
  { to: '/admin/daily-reports',        icon: FileDown,        label: 'Daily Reports' },
  { to: '/admin/attendance',           icon: FileBarChart,    label: 'Attendance Stats' },
  { to: '/admin/low-attendance',       icon: AlertTriangle,   label: 'Low Attendance' },
  { to: '/admin/reports',              icon: FileBarChart,    label: 'Reports' },
];

const hodLinks = [
  { to: '/hod',                        icon: LayoutDashboard, label: 'Dashboard',        end: true },
  { to: '/hod/take-attendance',        icon: QrCode,          label: 'QR Attendance' },
  { to: '/hod/daily-attendance',       icon: ClipboardList,   label: 'Daily Attendance' },
  { to: '/hod/daily-reports',          icon: FileDown,        label: 'Daily Reports' },
  { to: '/hod/sessions',               icon: History,         label: 'Session History' },
  { to: '/hod/students',               icon: GraduationCap,   label: 'Dept Students' },
  { to: '/hod/attendance',             icon: FileBarChart,    label: 'Attendance Stats' },
  { to: '/hod/low-attendance',         icon: AlertTriangle,   label: 'Low Attendance' },
  { to: '/hod/reports',                icon: FileBarChart,    label: 'Reports' },
];

const teacherLinks = [
  { to: '/teacher',                      icon: LayoutDashboard, label: 'Dashboard',        end: true },
  { to: '/teacher/take-attendance',      icon: QrCode,          label: 'QR Attendance' },
  { to: '/teacher/daily-attendance',     icon: ClipboardList,   label: 'Daily Attendance' },
  { to: '/teacher/daily-reports',        icon: FileDown,        label: 'Daily Reports' },
  { to: '/teacher/sessions',             icon: History,         label: 'Session History' },
  { to: '/teacher/reports',              icon: FileBarChart,    label: 'Reports' },
  { to: '/teacher/low-attendance',       icon: AlertTriangle,   label: 'Low Attendance' },
];

export default function Sidebar() {
  const { role } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = role === 'admin' ? adminLinks : role === 'hod' ? hodLinks : teacherLinks;

  const isLinkActive = (link) =>
    link.end ? location.pathname === link.to : location.pathname.startsWith(link.to);

  const navContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-surface-100">
      {/* Brand Header */}
      <div className={`flex items-center gap-3 pt-7 pb-6 shrink-0 ${collapsed && !isMobile ? 'px-3 justify-center' : 'px-6'}`}>
        <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 bg-white p-1.5 shadow-[0_4px_12px_rgba(108,75,193,0.18)] flex items-center justify-center">
          <img src={logo} alt="SSPI Logo" className="w-full h-full object-contain" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <p className="text-sm font-black text-surface-900 leading-tight truncate">SSPI Parbhani</p>
            <p className="text-[11px] font-semibold text-surface-500 leading-tight truncate">Smart QR Attendance</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-2 space-y-1 overflow-y-auto custom-scrollbar ${collapsed && !isMobile ? 'px-3' : 'px-4'}`}>
        {links.map((link) => {
          const active = isLinkActive(link);
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setMobileOpen(false)}
              className={`nav-item ${active ? 'active' : ''} ${collapsed && !isMobile ? 'justify-center px-2' : ''}`}
            >
              {active && (
                <motion.div
                  layoutId={isMobile ? 'active-pill-mobile' : 'active-pill'}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-[14px]"
                  style={{
                    background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.38)',
                  }}
                />
              )}
              <link.icon size={19} className="relative shrink-0" strokeWidth={2.25} />
              {(!collapsed || isMobile) && (
                <span className="relative flex-1 truncate">{link.label}</span>
              )}
              {link.label === 'Low Attendance' && (!collapsed || isMobile) && (
                <span className="relative w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer: collapse control only (profile + sign out now live in the top header) */}
      <div className={`shrink-0 mt-2 pt-4 pb-4 border-t border-surface-200/70 ${collapsed && !isMobile ? 'px-3' : 'px-4'}`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold text-surface-500 hover:text-surface-800 hover:bg-white/70 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={16} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-surface-100/95 backdrop-blur-md border-b border-surface-200/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white p-1 shadow-sm flex items-center justify-center">
            <img src={logo} alt="SSPI Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-sm font-black text-surface-900">SSPI Parbhani</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-primary-600 hover:bg-white/70 transition-colors"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile Overlay + Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-surface-950/40 backdrop-blur-sm z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[280px] shadow-2xl"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-surface-500 hover:bg-white/60 transition z-10"
              >
                <X size={18} />
              </button>
              {navContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar — Desktop */}
      <aside
        className={`hidden lg:block fixed top-0 left-0 bottom-0 p-4 transition-[width] duration-300 ease-out z-30 ${collapsed ? 'w-[92px]' : 'w-[264px]'}`}
      >
        <div className="h-full rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(108,75,193,0.12)] border border-white/70">
          {navContent(false)}
        </div>
      </aside>

      {/* Desktop spacer (keeps main content clear of the fixed sidebar) */}
      <div className={`hidden lg:block shrink-0 transition-[width] duration-300 ease-out ${collapsed ? 'w-[92px]' : 'w-[264px]'}`} />
    </>
  );
}
