export const DEPARTMENTS = [
  { value: 'ME', label: 'Mechanical Engineering' },
  { value: 'CE', label: 'Civil Engineering' },
  { value: 'CO', label: 'Computer Engineering' },
  { value: 'EJ', label: 'Electronics & Telecommunication' },
];

// Divisions used for Daily Attendance grouping
export const DIVISIONS = ['A', 'B', 'C', 'D'];

export const YEARS = [
  { value: 1, label: 'First Year' },
  { value: 2, label: 'Second Year' },
  { value: 3, label: 'Third Year' },
];

export const SEMESTERS = [
  { value: 1, label: 'Semester 1' },
  { value: 2, label: 'Semester 2' },
  { value: 3, label: 'Semester 3' },
  { value: 4, label: 'Semester 4' },
  { value: 5, label: 'Semester 5' },
  { value: 6, label: 'Semester 6' },
];

// Map year → available semesters
export const YEAR_SEMESTERS = {
  1: [1, 2],
  2: [3, 4],
  3: [5, 6],
};

// Map year + Odd/Even semester type → the actual semester number.
// Odd semester is always the first of the pair, Even is always the second.
export const SEMESTER_TYPES = [
  { value: 'odd', label: 'Odd Semester' },
  { value: 'even', label: 'Even Semester' },
];

export const getSemesterFromYearAndType = (year, semType) => {
  const pair = YEAR_SEMESTERS[parseInt(year)];
  if (!pair) return null;
  return semType === 'odd' ? pair[0] : semType === 'even' ? pair[1] : null;
};

export const TOKEN_EXPIRY_MINUTES = 3;
export const LOW_ATTENDANCE_THRESHOLD = 75;

// GPS Settings
export const COLLEGE_LATITUDE = 19.2557824;
export const COLLEGE_LONGITUDE = 76.7822683;
// MAX_ATTENDANCE_DISTANCE_METERS — the single source of truth for QR proximity.
// Must match the value hardcoded in migration_strict_10m_gps.sql (v_max_distance_meters := 10).
export const MAX_ATTENDANCE_DISTANCE_METERS = 10;
/** @deprecated Use MAX_ATTENDANCE_DISTANCE_METERS */
export const COLLEGE_RADIUS_METERS = MAX_ATTENDANCE_DISTANCE_METERS;
export const MAX_GPS_ACCURACY_METERS = 100;

// Admin credentials live in soft-copy (code / env). Change here to update admin login.
// Email + password — no DB row required for the master admin.
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@sspi.ac.in';
export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'sspi@admin2026';
/** @deprecated use ADMIN_PASSWORD */
export const ADMIN_MASTER_PASSWORD = ADMIN_PASSWORD;

export const INSTITUTE_NAME = 'Shri Shivaji Polytechnic Institute';
export const INSTITUTE_SHORT = 'SSPI';
export const INSTITUTE_LOCATION = 'Parbhani';
export const APP_NAME = 'SSPI Smart QR Attendance System';

export const getDeptLabel = (code) => {
  const dept = DEPARTMENTS.find(d => d.value === code);
  return dept ? dept.label : code;
};

export const getYearLabel = (year) => {
  const y = YEARS.find(y => y.value === year);
  return y ? y.label : `Year ${year}`;
};

export const getSemesterLabel = (sem) => {
  return `Semester ${sem}`;
};
