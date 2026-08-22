import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { formatDate, formatDateTime } from './utils';

/**
 * Generate an attendance Excel report
 */
export async function generateExcelReport({
  title,
  department,
  year,
  semester,
  subject,
  dateRange,
  students,
  sessions,
  attendanceMap,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SSPI Smart QR Attendance System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Attendance Report');

  // Header styling
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
  };
  const headerFont = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
    size: 11,
    name: 'Arial',
  };
  const subHeaderFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDBEAFE' },
  };
  const presentFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD1FAE5' },
  };
  const absentFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEE2E2' },
  };

  // Title rows
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Shri Shivaji Polytechnic Institute, Parbhani';
  titleCell.font = { bold: true, size: 14, name: 'Arial' };
  titleCell.alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:F2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = title;
  subtitleCell.font = { bold: true, size: 12, name: 'Arial', color: { argb: 'FF1E40AF' } };
  subtitleCell.alignment = { horizontal: 'center' };

  // Info rows
  sheet.getCell('A3').value = `Department: ${department}`;
  sheet.getCell('A3').font = { bold: true, size: 10 };
  sheet.getCell('C3').value = `Year: ${year} | Semester: ${semester}`;
  sheet.getCell('C3').font = { bold: true, size: 10 };
  
  if (subject) {
    sheet.getCell('A4').value = `Subject: ${subject}`;
    sheet.getCell('A4').font = { bold: true, size: 10 };
  }
  if (dateRange) {
    sheet.getCell('C4').value = `Period: ${dateRange}`;
    sheet.getCell('C4').font = { bold: true, size: 10 };
  }

  const startRow = 6;

  // Column headers
  const columns = [
    { header: 'Roll No', key: 'roll_no', width: 10 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Enrollment No', key: 'enrollment_no', width: 18 },
  ];

  // Add date columns if sessions exist
  if (sessions && sessions.length > 0) {
    sessions.forEach((session, i) => {
      columns.push({
        header: formatDate(session.created_at),
        key: `session_${i}`,
        width: 14,
      });
    });
  }

  columns.push({ header: 'Present', key: 'present_count', width: 10 });
  columns.push({ header: 'Total', key: 'total_count', width: 10 });
  columns.push({ header: 'Percentage', key: 'percentage', width: 12 });

  // Set columns
  sheet.columns = columns.map(col => ({ width: col.width }));

  // Write header row
  const headerRow = sheet.getRow(startRow);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Sort students by roll number
  const sortedStudents = [...students].sort((a, b) => a.roll_no - b.roll_no);

  // Write data rows
  sortedStudents.forEach((student, rowIndex) => {
    const row = sheet.getRow(startRow + 1 + rowIndex);
    let colIndex = 1;

    row.getCell(colIndex++).value = student.roll_no;
    row.getCell(colIndex++).value = student.name;
    row.getCell(colIndex++).value = student.enrollment_no;

    let presentCount = 0;
    const totalSessions = sessions ? sessions.length : 0;

    if (sessions) {
      sessions.forEach((session) => {
        const cell = row.getCell(colIndex++);
        const key = `${session.id}_${student.id}`;
        const isPresent = attendanceMap && attendanceMap[key];
        cell.value = isPresent ? 'P' : 'A';
        cell.fill = isPresent ? presentFill : absentFill;
        cell.alignment = { horizontal: 'center' };
        cell.font = {
          bold: true,
          color: { argb: isPresent ? 'FF065F46' : 'FF991B1B' },
        };
        if (isPresent) presentCount++;
      });
    }

    // If no sessions breakdown, use the attendanceMap directly
    if (!sessions && attendanceMap && attendanceMap[student.id]) {
      presentCount = attendanceMap[student.id].present || 0;
    }

    const total = totalSessions || (attendanceMap && attendanceMap[student.id] ? attendanceMap[student.id].total : 0) || 0;
    const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    row.getCell(colIndex++).value = presentCount;
    row.getCell(colIndex++).value = total;

    const pctCell = row.getCell(colIndex++);
    pctCell.value = `${pct}%`;
    pctCell.font = {
      bold: true,
      color: { argb: pct < 75 ? 'FFDC2626' : 'FF059669' },
    };

    // Borders
    for (let i = 1; i <= columns.length; i++) {
      row.getCell(i).border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
      row.getCell(i).alignment = { ...row.getCell(i).alignment, vertical: 'middle' };
    }
  });

  // Auto-fit columns
  sheet.columns.forEach(col => {
    col.width = Math.max(col.width || 10, 10);
  });

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `${title.replace(/\s+/g, '_')}_${formatDate(new Date())}.xlsx`;
  saveAs(blob, fileName);
}

/**
 * Generate CSV report
 */
export function generateCSVReport({
  title,
  students,
  sessions,
  attendanceMap,
}) {
  const sortedStudents = [...students].sort((a, b) => a.roll_no - b.roll_no);

  let headers = ['Roll No', 'Name', 'Enrollment No'];

  if (sessions && sessions.length > 0) {
    sessions.forEach(session => {
      headers.push(formatDate(session.created_at));
    });
  }

  headers.push('Present', 'Total', 'Percentage');

  const rows = sortedStudents.map(student => {
    const row = [student.roll_no, student.name, student.enrollment_no];

    let presentCount = 0;
    const totalSessions = sessions ? sessions.length : 0;

    if (sessions) {
      sessions.forEach(session => {
        const key = `${session.id}_${student.id}`;
        const isPresent = attendanceMap && attendanceMap[key];
        row.push(isPresent ? 'P' : 'A');
        if (isPresent) presentCount++;
      });
    }

    if (!sessions && attendanceMap && attendanceMap[student.id]) {
      presentCount = attendanceMap[student.id].present || 0;
    }

    const total = totalSessions || (attendanceMap && attendanceMap[student.id] ? attendanceMap[student.id].total : 0) || 0;
    const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    row.push(presentCount, total, `${pct}%`);
    return row;
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const fileName = `${title.replace(/\s+/g, '_')}_${formatDate(new Date())}.csv`;
  saveAs(blob, fileName);
}
