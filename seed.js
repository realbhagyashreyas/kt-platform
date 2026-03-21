const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ hostname: '127.0.0.1', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); }
        catch (e) { console.error('Failed to parse response for', path, ':', b.slice(0, 200)); resolve({}); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function seed() {
  // Accounts
  await post('/api/auth/register', { username: 'admin', password: 'admin123', display_name: 'KT Admin', user_type: 'associate' });
  await post('/api/auth/register', { username: 'newjoiner', password: 'welcome1', display_name: 'New Team Member', user_type: 'new_joiner' });

  // Applications
  const apps = [
    { name: 'Crew Management System', description: 'Manages crew scheduling, assignments, and duty tracking for all flight operations.' },
    { name: 'Flight Planning System', description: 'Handles flight plan creation, route optimization, fuel calculations, and ATC coordination.' },
    { name: 'Maintenance Control', description: 'Tracks aircraft maintenance schedules, defect reporting, and airworthiness compliance.' },
    { name: 'Revenue Accounting', description: 'Processes ticket sales, revenue recognition, interline billing, and financial reconciliation.' },
  ];
  for (const a of apps) await post('/api/applications', a);

  // DB2 Tables
  const tables = [
    { name: 'CREW_ROSTER', description: 'Stores crew member roster data including qualifications, base assignments, and availability.', application_id: 1 },
    { name: 'FLIGHT_SCHEDULE', description: 'Master flight schedule with routes, times, aircraft assignments, and operational status.', application_id: 2 },
    { name: 'DUTY_LOG', description: 'Records crew duty periods, rest times, and compliance with flight time limitations.', application_id: 1 },
    { name: 'AIRCRAFT_STATUS', description: 'Current status of each aircraft including serviceability, location, and next maintenance due.', application_id: 3 },
    { name: 'TICKET_SALES', description: 'Transaction records for all ticket sales including fare class, payment method, and PNR reference.', application_id: 4 },
    { name: 'ROUTE_MASTER', description: 'Master table of all routes with distance, sector times, and fuel burn profiles.', application_id: 2 },
    { name: 'MAINT_DEFECTS', description: 'Defect reports logged by crew and engineers with severity, status, and resolution details.', application_id: 3 },
    { name: 'REVENUE_JOURNAL', description: 'Financial journal entries for revenue recognition and interline settlement.', application_id: 4 },
  ];
  for (const t of tables) await post('/api/tables', t);

  // Programs
  const programs = [
    { name: 'CRWASN01', description: 'Crew assignment program', business_logic: 'Reads the flight schedule and crew roster to automatically assign qualified crew members to flights based on their qualifications, base location, and duty time remaining.', application_id: 1, read_tables: [1, 2], write_tables: [1, 3] },
    { name: 'FLTPLN01', description: 'Flight plan generator', business_logic: 'Takes route master data and aircraft status to generate optimized flight plans with fuel calculations, alternate airports, and weather considerations.', application_id: 2, read_tables: [6, 4], write_tables: [2] },
    { name: 'DUTYCK01', description: 'Duty time compliance checker', business_logic: 'Scans duty logs against regulatory limits to flag any crew members approaching maximum flight time or minimum rest violations.', application_id: 1, read_tables: [3, 1], write_tables: [3] },
    { name: 'MNTSCH01', description: 'Maintenance scheduler', business_logic: 'Reads aircraft status and defect reports to schedule maintenance tasks, ensuring aircraft remain airworthy and compliant with maintenance programs.', application_id: 3, read_tables: [4, 7], write_tables: [4] },
    { name: 'TKTREV01', description: 'Ticket revenue processor', business_logic: 'Processes ticket sales transactions, applies fare rules, calculates taxes, and posts revenue journal entries for financial reporting.', application_id: 4, read_tables: [5], write_tables: [8] },
    { name: 'DEFLOG01', description: 'Defect logging program', business_logic: 'Allows engineers and crew to log aircraft defects with severity classification. Updates aircraft status if defect affects serviceability.', application_id: 3, read_tables: [4], write_tables: [7, 4] },
  ];
  for (const p of programs) await post('/api/programs', p);

  // Business Roles
  const roles = [
    { name: 'MCC', description: 'Mainframe Control Centre - monitors all operational systems, handles real-time disruptions, and coordinates between crew, maintenance, and flight planning.', application_ids: [1, 2, 3], program_ids: [1, 2, 3, 4] },
    { name: 'Planner', description: 'Flight and crew planners who create schedules, optimize routes, and ensure adequate crew coverage for all operations.', application_ids: [1, 2], program_ids: [1, 2, 3] },
    { name: 'AMT', description: 'Aircraft Maintenance Technician - responsible for aircraft inspections, defect rectification, and maintenance documentation.', application_ids: [3], program_ids: [4, 6] },
    { name: 'Cabin Crew', description: 'Flight attendants who view their roster assignments, report duty times, and log cabin defects.', application_ids: [1], program_ids: [3, 6] },
    { name: 'Revenue Analyst', description: 'Analyzes ticket sales data, monitors revenue performance, and manages interline billing processes.', application_ids: [4], program_ids: [5] },
  ];
  for (const r of roles) await post('/api/roles', r);

  console.log('Seed complete!');
}

seed().catch(console.error);
