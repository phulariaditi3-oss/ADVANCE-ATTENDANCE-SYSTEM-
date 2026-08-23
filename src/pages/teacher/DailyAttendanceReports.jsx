import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { DEPARTMENTS, YEARS, getDeptLabel, getYearLabel } from '../../lib/constants';
import { motion } from 'framer-motion';
import {
  BarChart3, Download, Filter, Sun, Sunset, User,
  CalendarDays, TrendingUp, Loader2, FileDown
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const currentDate = () => new Date().toISOString().split('T')[0];

export default function DailyAttendanceReports() {
  const { user } = useAuth();

  const teachingDepts = useMemo(
    () => (user?.teachingDepartments?.length
      ? user.teachingDepartments
      : [user?.department].filter(Boolean)),
    [user],
  );

  const [department, setDepartment] = useState(teachingDepts[0] || '');
  const [year, setYear]             = useState('');
  const [reportType, setReportType] = useState('monthly'); // daily, weekly, monthly, semester
  const [selectedDate, setSelectedDate] = useState(currentDate());
  const [loading, setLoading]       = useState(false);
  const [rows, setRows]             = useState([]);   // per-student summary

  const fetchReport = async () => {
    if (!department || !year) return;
    setLoading(true);
    try {
      let startDate, endDate;

      if (reportType === 'daily') {
        startDate = selectedDate;
        endDate = selectedDate;
      } else if (reportType === 'weekly') {
        const d = new Date(selectedDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(d.setDate(diff)).toISOString().split('T')[0];
        endDate = new Date(d.setDate(diff + 6)).toISOString().split('T')[0];
      } else if (reportType === 'monthly') {
        const [y, m] = selectedDate.split('-');
        startDate = `${y}-${m}-01`;
        endDate   = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10);
      } else if (reportType === 'semester') {
        // Broad range or rely strictly on department+year
        startDate = '2000-01-01';
        endDate = '2100-12-31';
      }

      /* 1. Get all students in this dept+year */
      const { data: studs } = await supabase
        .from('students')
        .select('id, name, roll_no, enrollment_no')
        .eq('department', department)
        .eq('year', parseInt(year))
        .eq('is_active', true)
        .order('roll_no');

      if (!studs || studs.length === 0) { setRows([]); return; }

      /* 2. Fetch all attendance records for this class + month */
      const ids = studs.map(s => s.id);
      const { data: rawAtt } = await supabase
        .from('attendance')
        .select(`
          student_id, 
          status,
          session:sessions!inner(
            session_date,
            session_type,
            attendance_type
          )
        `)
        .in('student_id', ids)
        .eq('session.attendance_type', 'daily')
        .gte('session.session_date', startDate)
        .lte('session.session_date', endDate);

      const att = (rawAtt || []).map(r => ({
        student_id: r.student_id,
        status: r.status,
        date: r.session.session_date,
        session_type: r.session.session_type
      }));

      /* 3. Compute working days from distinct dates with at least one record */
      const datesWithRecords = new Set((att || []).map(r => r.date));
      const totalDays = datesWithRecords.size;

      /* 4. Aggregate per student */
      const summary = studs.map(s => {
        const mine = (att || []).filter(r => r.student_id === s.id);
        const morningPresent   = mine.filter(r => r.session_type === 'morning'   && r.status === 'present').length;
        const afternoonPresent = mine.filter(r => r.session_type === 'afternoon' && r.status === 'present').length;
        const morningTotal     = mine.filter(r => r.session_type === 'morning').length;
        const afternoonTotal   = mine.filter(r => r.session_type === 'afternoon').length;
        const overallPresent   = morningPresent + afternoonPresent;
        const overallTotal     = morningTotal + afternoonTotal;
        const pct = overallTotal > 0 ? ((overallPresent / overallTotal) * 100).toFixed(1) : '–';
        return { ...s, morningPresent, morningTotal, afternoonPresent, afternoonTotal, overallPresent, overallTotal, pct };
      });

      setRows(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (department && year) fetchReport();
  }, [department, year, reportType, selectedDate]);

  const handleDownload = async (format) => {
    if (rows.length === 0) return;
    
    if (format === 'csv') {
      const headers = ['Roll No', 'Name', 'Enrollment No', 'Morning Present', 'Morning Total', 'Afternoon Present', 'Afternoon Total', 'Overall %'];
      const csvRows = rows.map(r => [
        r.roll_no,
        `"${r.name}"`,
        `"${r.enrollment_no}"`,
        r.morningPresent,
        r.morningTotal,
        r.afternoonPresent,
        r.afternoonTotal,
        `"${r.pct}%"`
      ].join(','));
      
      const csvContent = [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `Daily_Attendance_${department}_${year}_${reportType}_${selectedDate}.csv`);
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Daily Attendance');
      
      sheet.columns = [
        { header: 'Roll No', key: 'roll_no', width: 10 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Enrollment No', key: 'enrollment_no', width: 18 },
        { header: 'Morning Present', key: 'morningPresent', width: 18 },
        { header: 'Morning Total', key: 'morningTotal', width: 18 },
        { header: 'Afternoon Present', key: 'afternoonPresent', width: 18 },
        { header: 'Afternoon Total', key: 'afternoonTotal', width: 18 },
        { header: 'Overall %', key: 'pct', width: 12 },
      ];
      
      sheet.getRow(1).font = { bold: true };
      
      rows.forEach(r => {
        sheet.addRow({
          roll_no: r.roll_no,
          name: r.name,
          enrollment_no: r.enrollment_no,
          morningPresent: r.morningPresent,
          morningTotal: r.morningTotal,
          afternoonPresent: r.afternoonPresent,
          afternoonTotal: r.afternoonTotal,
          pct: `${r.pct}%`
        });
      });
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Daily_Attendance_${department}_${year}_${reportType}_${selectedDate}.xlsx`);
    }
  };

  const pctColor = pct => {
    if (pct === '–') return 'text-surface-400';
    return parseFloat(pct) >= 75 ? 'text-emerald-600' : 'text-danger-600';
  };

  return (
    <div className="page-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-surface-900 flex items-center gap-2">
            <BarChart3 size={22} className="text-primary-500" />
            Daily Attendance Report
          </h1>
          <p className="text-sm font-bold text-surface-500 mt-1">Morning &amp; Afternoon attendance summary</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-5 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="label">Department</label>
          <select value={department} onChange={e => { setDepartment(e.target.value); setYear(''); }} className="select">
            <option value="">Select</option>
            {teachingDepts.map(c => <option key={c} value={c}>{getDeptLabel(c)}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="label">Year / Class</label>
          <select value={year} onChange={e => setYear(e.target.value)} className="select" disabled={!department}>
            <option value="">Select</option>
            {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="label">Report Period</label>
          <select value={reportType} onChange={e => {
            setReportType(e.target.value);
            setSelectedDate(e.target.value === 'monthly' ? currentMonth() : currentDate());
          }} className="select">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="semester">Semester</option>
          </select>
        </div>
        
        {reportType !== 'semester' && (
          <div className="flex-1">
            <label className="label flex items-center gap-1.5"><CalendarDays size={12} /> {reportType === 'monthly' ? 'Month' : 'Date'}</label>
            <input type={reportType === 'monthly' ? 'month' : 'date'} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input" />
          </div>
        )}
        <button onClick={fetchReport} disabled={!department || !year || loading} className="btn-primary whitespace-nowrap disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Filter size={15} />}
          {loading ? 'Loading…' : 'Load Report'}
        </button>
        {rows.length > 0 && (
          <div className="flex gap-2 w-full sm:w-auto mt-3 sm:mt-0">
            <button onClick={() => handleDownload('excel')} className="btn-secondary whitespace-nowrap flex-1 sm:flex-none justify-center border-surface-200">
              <FileDown size={15} /> Excel
            </button>
            <button onClick={() => handleDownload('csv')} className="btn-secondary whitespace-nowrap flex-1 sm:flex-none justify-center border-surface-200">
              <FileDown size={15} /> CSV
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading && (
        <div className="card p-12 flex flex-col items-center text-center">
          <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin mb-4" />
          <p className="font-bold text-surface-600">Generating report…</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
            <p className="font-black text-surface-900">
              {getDeptLabel(department)} — {getYearLabel(parseInt(year))} &nbsp;·&nbsp; {rows.length} students
            </p>
            <span className="text-xs font-bold text-surface-400 uppercase">{reportType} {reportType !== 'semester' && selectedDate}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-surface-500 w-12">Roll</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-surface-500">Student</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-amber-500 whitespace-nowrap">
                    <Sun size={12} className="inline mr-1" />Morning Present
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-surface-400">Morning Total</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-indigo-500 whitespace-nowrap">
                    <Sunset size={12} className="inline mr-1" />Afternoon Present
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-surface-400">Afternoon Total</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-primary-500">Overall %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {rows.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-surface-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-black text-surface-400 font-mono">{String(r.roll_no).padStart(2, '0')}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-surface-900">{r.name}</p>
                      <p className="text-[11px] text-surface-400 font-mono">{r.enrollment_no}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-black text-amber-600">{r.morningPresent}</td>
                    <td className="px-4 py-3 text-center font-bold text-surface-500">{r.morningTotal}</td>
                    <td className="px-4 py-3 text-center font-black text-indigo-600">{r.afternoonPresent}</td>
                    <td className="px-4 py-3 text-center font-bold text-surface-500">{r.afternoonTotal}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-black text-base ${pctColor(r.pct)}`}>{r.pct}{r.pct !== '–' ? '%' : ''}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {!loading && rows.length === 0 && department && year && (
        <div className="card p-10 text-center text-surface-400">
          <TrendingUp size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-bold">No daily attendance records found for this selection.</p>
        </div>
      )}
    </div>
  );
}
