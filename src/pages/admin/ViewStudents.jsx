import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { DEPARTMENTS, YEARS, getDeptLabel } from '../../lib/constants';
import { Search, GraduationCap, Users } from 'lucide-react';

export default function ViewStudents() {
  const { role, user } = useAuth();
  const isHod = role === 'hod';
  const hodDept = isHod ? user?.department : null;

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState(hodDept || '');
  const [yearFilter, setYearFilter] = useState('');

  useEffect(() => {
    fetchStudents();
  }, [hodDept]);

  const fetchStudents = async () => {
    setLoading(true);
    let query = supabase
      .from('students')
      .select('*')
      .order('department')
      .order('year')
      .order('roll_no');

    if (hodDept) {
      query = query.eq('department', hodDept);
    }

    const { data } = await query;
    setStudents(data || []);
    setLoading(false);
  };

  const filtered = students.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollment_no.toLowerCase().includes(search.toLowerCase());
    const matchDept = !deptFilter || s.department === deptFilter;
    const matchYear = !yearFilter || s.year === parseInt(yearFilter);
    return matchSearch && matchDept && matchYear;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">
          {isHod ? `${getDeptLabel(hodDept)} Students` : 'Student Directory'}
        </h1>
        <p className="text-stone-500 text-sm mt-0.5">
          {isHod
            ? `${students.length} students in your department`
            : `${students.length} enrolled students across all departments`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input !pl-12 py-3 rounded-2xl"
            placeholder="Search name or enrollment no..."
          />
        </div>
        {!isHod && (
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="select w-auto py-3 rounded-2xl">
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        )}
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="select w-auto py-3 rounded-2xl">
          <option value="">All Years</option>
          {YEARS.map(y => (
            <option key={y.value} value={y.value}>{y.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Enrollment No</th>
                <th>Gender</th>
                <th>Department</th>
                <th>Year</th>
                <th>Semester</th>
                <th>Mobile</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-stone-500 font-medium">
                      <div className="w-5 h-5 border-2 border-stone-300 border-t-red-900 rounded-full animate-spin" />
                      Loading student roster...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-stone-500 font-medium">
                    No students found
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="font-bold">{s.roll_no}</td>
                    <td className="font-semibold text-stone-900">{s.name}</td>
                    <td className="font-mono text-sm">{s.enrollment_no}</td>
                    <td>{s.gender}</td>
                    <td>{getDeptLabel(s.department)}</td>
                    <td>Year {s.year}</td>
                    <td>Sem {s.semester}</td>
                    <td className="font-mono text-sm">{s.student_mobile}</td>
                    <td>
                      {s.is_active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
