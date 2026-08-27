import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { hashPassword, verifyPassword } from '../lib/utils';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('sspi_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed.user);
        setRole(parsed.role);
      } catch {
        localStorage.removeItem('sspi_auth');
      }
    }
    setLoading(false);
  }, []);

  // Save session to localStorage
  const saveSession = useCallback((userData, userRole) => {
    setUser(userData);
    setRole(userRole);
    localStorage.setItem('sspi_auth', JSON.stringify({ user: userData, role: userRole }));
  }, []);

  // Admin login via Supabase Auth
  const loginAdmin = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: (email || '').toLowerCase().trim(),
      password,
    });

    if (error || !data.user) {
      return { success: false, error: 'Invalid admin email or password' };
    }

    const adminData = {
      id: data.user.id,
      name: 'Administrator',
      email: data.user.email,
      role: 'admin',
    };
    saveSession(adminData, 'admin');
    return { success: true };
  }, [saveSession]);

  // Staff / HOD login
  const loginStaff = useCallback(async (staffId, email, password) => {
    try {
      const { data: staff, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
        .eq('email', email.toLowerCase().trim())
        .single();

      if (error || !staff) {
        return { success: false, error: 'Invalid email. Please check your credentials.' };
      }

      if (!staff.is_active) {
        return { success: false, error: 'Your account has been deactivated. Contact admin.' };
      }

      const valid = await verifyPassword(password, staff.password_hash);
      if (!valid) {
        return { success: false, error: 'Invalid password.' };
      }

      const staffRole = staff.role === 'hod' ? 'hod' : 'staff';

      // Fetch which departments this staff member is allowed to teach /
      // generate attendance QR sessions for. Falls back to their single
      // home department if the assignment table has no rows for them yet
      // (e.g. right after upgrading an older account).
      let teachingDepartments = [staff.department];
      try {
        const { data: deptRows } = await supabase
          .from('staff_departments')
          .select('department_code')
          .eq('staff_id', staff.id);
        if (deptRows && deptRows.length > 0) {
          teachingDepartments = deptRows.map(r => r.department_code);
        }
      } catch {
        // Non-fatal — keep the fallback above
      }

      const staffData = {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        department: staff.department,
        teachingDepartments,
        staff_id: staff.staff_id,
        role: staffRole,
      };
      saveSession(staffData, staffRole);
      return { success: true, role: staffRole };
    } catch (err) {
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }, [saveSession]);

  // Student login
  const loginStudent = useCallback(async (email, password) => {
    try {
      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (error || !student) {
        return { success: false, error: 'No account found with this email.' };
      }

      if (!student.is_active) {
        return { success: false, error: 'Your account has been deactivated. Contact admin.' };
      }

      const valid = await verifyPassword(password, student.password_hash);
      if (!valid) {
        return { success: false, error: 'Invalid password.' };
      }

      // Check max 2 active sessions limit
      let deviceSessionId = localStorage.getItem('sspi_device_session');
      if (!deviceSessionId) {
        deviceSessionId = crypto.randomUUID();
        localStorage.setItem('sspi_device_session', deviceSessionId);
      }

      const { data: sessionData, error: sessionErr } = await supabase.rpc('student_login_check', {
        p_student_id: student.id,
        p_session_id: deviceSessionId
      });

      if (sessionErr) {
        return { success: false, error: 'Failed to verify session limit.' };
      }

      if (sessionData && !sessionData.success) {
        return { success: false, error: sessionData.message };
      }

      const studentData = {
        id: student.id,
        name: student.name,
        email: student.email,
        enrollment_no: student.enrollment_no,
        roll_no: student.roll_no,
        gender: student.gender,
        department: student.department,
        year: student.year,
        semester: student.semester,
        student_mobile: student.student_mobile,
        parent_mobile: student.parent_mobile,
      };
      saveSession(studentData, 'student');
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }, [saveSession]);

  // Student registration
  const registerStudent = useCallback(async (formData) => {
    try {
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('enrollment_no', formData.enrollment_no.trim())
        .single();

      if (existing) {
        return { success: false, error: 'Enrollment number already registered.' };
      }

      const { data: existingEmail } = await supabase
        .from('students')
        .select('id')
        .eq('email', formData.email.toLowerCase().trim())
        .single();

      if (existingEmail) {
        return { success: false, error: 'Email already registered.' };
      }

      const { data: existingRoll } = await supabase
        .from('students')
        .select('id')
        .eq('department', formData.department)
        .eq('year', parseInt(formData.year))
        .eq('roll_no', parseInt(formData.roll_no))
        .single();

      if (existingRoll) {
        return {
          success: false,
          error: `Roll number ${formData.roll_no} already taken in ${formData.department} Year ${formData.year}.`,
        };
      }

      const passwordHash = await hashPassword(formData.password);

      const { data, error } = await supabase
        .from('students')
        .insert({
          name: formData.name.trim(),
          enrollment_no: formData.enrollment_no.trim(),
          roll_no: parseInt(formData.roll_no),
          gender: formData.gender || 'Male',
          email: formData.email.toLowerCase().trim(),
          password_hash: passwordHash,
          department: formData.department,
          year: parseInt(formData.year),
          semester: parseInt(formData.semester),
          student_mobile: formData.student_mobile.trim(),
          parent_mobile: formData.parent_mobile.trim(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Duplicate entry detected. Please check your details.' };
        }
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err) {
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const stored = localStorage.getItem('sspi_auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.role === 'student') {
          const deviceSessionId = localStorage.getItem('sspi_device_session');
          if (deviceSessionId) {
            await supabase.rpc('student_logout', { p_session_id: deviceSessionId });
          }
        }
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    setRole(null);
    localStorage.removeItem('sspi_auth');
  }, []);

  const value = {
    user,
    role,
    loading,
    loginAdmin,
    loginStaff,
    loginStudent,
    registerStudent,
    logout,
    isAuthenticated: !!user,
    isAdmin: role === 'admin',
    isHod: role === 'hod',
    isStaff: role === 'staff',
    isStudent: role === 'student',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}