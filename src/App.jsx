import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SplashScreen from './components/SplashScreen';

// Layouts
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import StudentNavbar from './components/StudentNavbar';

// Auth Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageStaff from './pages/admin/ManageStaff';
import ViewStudents from './pages/admin/ViewStudents';
import AttendanceStats from './pages/admin/AttendanceStats';
import LowAttendance from './pages/admin/LowAttendance';
import AdminReports from './pages/admin/AdminReports';

// Teacher Pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TakeAttendance from './pages/teacher/TakeAttendance';
import SessionHistory from './pages/teacher/SessionHistory';
import TeacherReports from './pages/teacher/TeacherReports';
import TeacherLowAttendance from './pages/teacher/TeacherLowAttendance';
import DailyAttendance from './pages/teacher/DailyAttendance';
import DailyAttendanceReports from './pages/teacher/DailyAttendanceReports';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import ScanAttendance from './pages/student/ScanAttendance';
import AttendanceHistory from './pages/student/AttendanceHistory';
import DailyAttendanceHistory from './pages/student/DailyAttendanceHistory';

function AnimatedOutlet() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}

function AdminTeacherLayout() {
  return (
    <div className="flex min-h-screen bg-surface-50">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto !pt-[4.5rem] lg:!pt-0">
        <TopHeader />
        <AnimatedOutlet />
      </main>
    </div>
  );
}

function StudentLayout() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <StudentNavbar />
      <main className="flex-1 py-6 px-4">
        <AnimatedOutlet />
      </main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, role } = useAuth();
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash screen on first load in session
    return !sessionStorage.getItem('sspi_splash_seen');
  });

  const handleSplashFinish = () => {
    sessionStorage.setItem('sspi_splash_seen', 'true');
    setShowSplash(false);
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      </AnimatePresence>

      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Admin Protected Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminTeacherLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="staff" element={<ManageStaff />} />
          <Route path="students" element={<ViewStudents />} />
          <Route path="daily-attendance" element={<DailyAttendance />} />
          <Route path="daily-reports" element={<DailyAttendanceReports />} />
          <Route path="attendance" element={<AttendanceStats />} />
          <Route path="low-attendance" element={<LowAttendance />} />
          <Route path="reports" element={<AdminReports />} />
        </Route>

        {/* HOD Protected Routes — same views as admin, scoped to their department,
            plus attendance-taking since an HOD may also teach subjects. */}
        <Route
          path="/hod"
          element={
            <ProtectedRoute allowedRoles={['hod']}>
              <AdminTeacherLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="students" element={<ViewStudents />} />
          <Route path="daily-attendance" element={<DailyAttendance />} />
          <Route path="daily-reports" element={<DailyAttendanceReports />} />
          <Route path="attendance" element={<AttendanceStats />} />
          <Route path="low-attendance" element={<LowAttendance />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="take-attendance" element={<TakeAttendance />} />
          <Route path="sessions" element={<SessionHistory />} />
        </Route>

        {/* Teacher Protected Routes */}
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <AdminTeacherLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<TeacherDashboard />} />
          <Route path="take-attendance" element={<TakeAttendance />} />
          <Route path="daily-attendance" element={<DailyAttendance />} />
          <Route path="daily-reports" element={<DailyAttendanceReports />} />
          <Route path="sessions" element={<SessionHistory />} />
          <Route path="reports" element={<TeacherReports />} />
          <Route path="low-attendance" element={<TeacherLowAttendance />} />
        </Route>

        {/* Student Protected Routes */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentDashboard />} />
          <Route path="scan" element={<ScanAttendance />} />
          <Route path="history" element={<AttendanceHistory />} />
          <Route path="daily-history" element={<DailyAttendanceHistory />} />
        </Route>

        {/* Redirect Fallbacks */}
        <Route
          path="*"
          element={
            isAuthenticated ? (
              role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : role === 'hod' ? (
                <Navigate to="/hod" replace />
              ) : role === 'staff' ? (
                <Navigate to="/teacher" replace />
              ) : (
                <Navigate to="/student" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </>
  );
}
