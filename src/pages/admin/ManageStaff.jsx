import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { hashPassword } from '../../lib/utils';
import { DEPARTMENTS } from '../../lib/constants';
import { Shield, Plus, Edit2, Trash2, CheckCircle2, XCircle, Search, Eye, EyeOff, KeyRound } from 'lucide-react';
import LoadingSkeleton from '../../components/LoadingSkeleton';

export default function ManageStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const toast = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    teaching_departments: [],
    staff_id: '',
    role: 'teacher',
    password: '',
    is_active: true
  });
  const [staffDeptMap, setStaffDeptMap] = useState({}); // staff_id -> [dept codes]

  const departments = DEPARTMENTS; // [{ value: 'CO', label: 'Computer Engineering' }, ...] — matches the DB check constraint

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('name');

      if (error) throw error;
      setStaff(data || []);

      // Load teaching-department assignments for all staff in one go
      const { data: deptRows } = await supabase
        .from('staff_departments')
        .select('staff_id, department_code');

      const map = {};
      (deptRows || []).forEach(row => {
        if (!map[row.staff_id]) map[row.staff_id] = [];
        map[row.staff_id].push(row.department_code);
      });
      setStaffDeptMap(map);
    } catch (err) {
      toast.error('Failed to load staff members');
    } finally {
      setLoading(false);
    }
  };

  const toggleTeachingDept = (code) => {
    setFormData(prev => {
      // The core/home department must always remain in the teaching list —
      // it doesn't make sense for a staff member to not be able to teach
      // their own department.
      if (code === prev.department) return prev;
      const has = prev.teaching_departments.includes(code);
      return {
        ...prev,
        teaching_departments: has
          ? prev.teaching_departments.filter(c => c !== code)
          : [...prev.teaching_departments, code],
      };
    });
  };

  const handleCoreDeptChange = (code) => {
    setFormData(prev => ({
      ...prev,
      department: code,
      // Always make sure the new core department is included among the
      // departments this staff member can take attendance for.
      teaching_departments: prev.teaching_departments.includes(code)
        ? prev.teaching_departments
        : [...prev.teaching_departments, code],
    }));
  };

  const handleOpenModal = (staffMember = null) => {
    setShowPassword(false);
    if (staffMember) {
      setEditingStaff(staffMember);
      setFormData({
        name: staffMember.name,
        email: staffMember.email,
        department: staffMember.department,
        teaching_departments: staffDeptMap[staffMember.id]?.length
          ? staffDeptMap[staffMember.id]
          : [staffMember.department],
        staff_id: staffMember.staff_id,
        role: staffMember.role === 'hod' ? 'hod' : 'teacher',
        password: '',
        is_active: staffMember.is_active
      });
    } else {
      setEditingStaff(null);
      setFormData({
        name: '', email: '', department: departments[0].value, teaching_departments: [departments[0].value], staff_id: '', role: 'teacher', password: '', is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (formData.password && formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!editingStaff && !formData.password) {
      toast.error('Password is required for a new staff account');
      return;
    }
    if (formData.teaching_departments.length === 0) {
      toast.error('Select at least one teaching department');
      return;
    }

    setSaving(true);
    try {
      const { password, teaching_departments, ...rest } = formData;
      // `department` (the explicit Core Department field) is the staff
      // member's primary/home department — used for HOD scoping and
      // legacy reports. It's always included in teaching_departments too.
      let staffId = editingStaff?.id;

      if (editingStaff) {
        const payload = { ...rest };
        if (password) {
          payload.password_hash = await hashPassword(password);
        }
        const { error } = await supabase
          .from('staff')
          .update(payload)
          .eq('id', editingStaff.id);
        if (error) throw error;
        toast.success('Staff updated successfully');
      } else {
        const payload = { ...rest, password_hash: await hashPassword(password) };
        const { data: inserted, error } = await supabase
          .from('staff')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        staffId = inserted.id;
        toast.success('Staff added successfully');
      }

      // Replace the teaching-department assignments for this staff member
      if (staffId) {
        await supabase.from('staff_departments').delete().eq('staff_id', staffId);
        const rows = teaching_departments.map(code => ({ staff_id: staffId, department_code: code }));
        const { error: deptErr } = await supabase.from('staff_departments').insert(rows);
        if (deptErr) throw deptErr;
      }

      setIsModalOpen(false);
      fetchStaff();
    } catch (err) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        const { error } = await supabase.from('staff').delete().eq('id', id);
        if (error) throw error;
        toast.success('Staff deleted successfully');
        fetchStaff();
      } catch (err) {
        toast.error('Failed to delete staff');
      }
    }
  };

  const filteredStaff = staff.filter(s => {
    const q = search.toLowerCase();
    const depts = staffDeptMap[s.id]?.length ? staffDeptMap[s.id] : [s.department];
    return (
      s.name.toLowerCase().includes(q) ||
      depts.some(d => d.toLowerCase().includes(q)) ||
      s.staff_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 tracking-tight">Manage Staff &amp; HODs</h1>
          <p className="section-subtitle mt-1">Add teachers or Head of Department (HOD) accounts</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary self-start sm:self-auto">
          <Plus size={17} /> Add Staff / HOD
        </button>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
          <div className="relative max-w-sm w-full">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, ID, or dept..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input !pl-11"
            />
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-surface-600">
            Total Faculty: <span className="text-primary-600 font-black text-base">{staff.length}</span>
          </div>
        </div>

        {loading ? <LoadingSkeleton /> : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Faculty Name</th>
                  <th>Staff ID</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <p className="font-bold text-surface-600 text-sm">No staff members found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map(member => (
                    <tr key={member.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-black shrink-0 ${member.role === 'hod' ? 'bg-amber-500' : 'bg-primary-500'}`}>
                            {member.name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-surface-900">{member.name}</p>
                            <p className="text-xs text-surface-500 font-medium truncate">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-sm font-bold text-surface-700">{member.staff_id}</td>
                      <td className="text-sm font-semibold text-surface-700">
                        <div className="flex flex-wrap gap-1">
                          {(staffDeptMap[member.id]?.length ? staffDeptMap[member.id] : [member.department]).map(code => (
                            <span
                              key={code}
                              className={`badge border ${
                                code === member.department
                                  ? 'bg-primary-100 text-primary-800 border-primary-300 font-black'
                                  : 'bg-primary-50 text-primary-700 border-primary-100'
                              }`}
                              title={code === member.department ? 'Core department' : 'Teaching department'}
                            >
                              {code}{code === member.department ? ' ★' : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {member.role === 'hod' ? (
                          <span className="badge bg-amber-100 text-amber-800 border border-amber-200"><Shield size={12}/> HOD</span>
                        ) : (
                          <span className="badge badge-success">Teacher</span>
                        )}
                      </td>
                      <td>
                        {member.is_active ? (
                          <span className="badge badge-success"><CheckCircle2 size={13}/> Active</span>
                        ) : (
                          <span className="badge badge-danger"><XCircle size={13}/> Inactive</span>
                        )}
                      </td>
                      <td className="text-right space-x-1">
                        <button onClick={() => handleOpenModal(member)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(member.id, member.name)} className="p-2 text-danger-500 hover:bg-danger-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content !bg-white" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-surface-900 mb-6 flex items-center gap-2.5">
              <Shield className="text-primary-500" size={22} />
              {editingStaff ? 'Edit Staff / HOD' : 'Add Staff or HOD'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4" autoComplete="off">
              <div>
                <label className="label">Full Name</label>
                <input type="text" className="input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" />
              </div>

              <div>
                <label className="label">Staff ID</label>
                <input type="text" className="input uppercase" required autoComplete="off" name="staff-id-field" value={formData.staff_id} onChange={e => setFormData({...formData, staff_id: e.target.value.toUpperCase()})} placeholder="e.g. CS-01" />
              </div>

              <div>
                <label className="label">Core Department</label>
                <p className="text-xs text-surface-500 font-medium mb-2 -mt-0.5">
                  This staff member's home/primary branch. Used for HOD scoping and reports.
                </p>
                <select
                  className="select"
                  value={formData.department}
                  onChange={e => handleCoreDeptChange(e.target.value)}
                >
                  {departments.map(d => (
                    <option key={d.value} value={d.value}>{d.value} — {d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Teaching Departments</label>
                <p className="text-xs text-surface-500 font-medium mb-2 -mt-0.5">
                  Which departments can this staff member take attendance for? Their core department is always included.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {departments.map(d => {
                    const checked = formData.teaching_departments.includes(d.value);
                    const isCore = d.value === formData.department;
                    return (
                      <label
                        key={d.value}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 transition-colors ${
                          isCore ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                        } ${
                          checked ? 'border-primary-400 bg-primary-50' : 'border-surface-200 bg-white hover:border-surface-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-primary-500 rounded shrink-0"
                          checked={checked}
                          disabled={isCore}
                          onChange={() => toggleTeachingDept(d.value)}
                        />
                        <span className="text-xs font-bold text-surface-800">
                          <span className="font-mono">{d.value}</span> — {d.label}
                          {isCore && <span className="ml-1.5 text-primary-600">(Core)</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="label">Role</label>
                <select
                  className="select"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="teacher">Teacher (take attendance, reports)</option>
                  <option value="hod">HOD — Head of Department (manage dept students)</option>
                </select>
                <p className="text-xs text-surface-500 mt-1.5 font-medium">
                  HOD can view &amp; manage students of their department only (like a department admin).
                </p>
              </div>

              <div>
                <label className="label">Email</label>
                <input type="email" className="input" required autoComplete="off" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="staff@institute.edu" />
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <KeyRound size={13} />
                  Password {editingStaff && <span className="text-surface-400 font-medium normal-case">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input !pr-11"
                    required={!editingStaff}
                    minLength={6}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder={editingStaff ? 'Enter new password' : 'Minimum 6 characters'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700 transition-colors"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input type="checkbox" id="isActive" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-4 h-4 accent-primary-500 rounded" />
                <label htmlFor="isActive" className="text-sm font-bold text-surface-700 cursor-pointer">Active Account</label>
              </div>

              <div className="flex gap-3 pt-6 mt-4 border-t border-surface-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-60">
                  {saving ? 'Saving...' : editingStaff ? 'Save Changes' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
