const db = require('./db');

// Accounts
db.prepare(`INSERT OR IGNORE INTO accounts (username,password,display_name,user_type) VALUES (?,?,?,?)`).run('admin','admin123','KT Admin','associate');
db.prepare(`INSERT OR IGNORE INTO accounts (username,password,display_name,user_type) VALUES (?,?,?,?)`).run('newjoiner','welcome1','New Team Member','new_joiner');

// Applications
const insApp = db.prepare(`INSERT OR IGNORE INTO applications (name,description) VALUES (?,?)`);
insApp.run('Crew Management System','Manages crew scheduling, assignments, and duty tracking for all flight operations.');
insApp.run('Flight Planning System','Handles flight plan creation, route optimization, fuel calculations, and ATC coordination.');
insApp.run('Maintenance Control','Tracks aircraft maintenance schedules, defect reporting, and airworthiness compliance.');
insApp.run('Revenue Accounting','Processes ticket sales, revenue recognition, interline billing, and financial reconciliation.');

// DB2 Tables
const insTbl = db.prepare(`INSERT OR IGNORE INTO db2_tables (name,description,application_id) VALUES (?,?,?)`);
insTbl.run('CREW_ROSTER','Stores crew member roster data including qualifications, base assignments, and availability.',1);
insTbl.run('FLIGHT_SCHEDULE','Master flight schedule with routes, times, aircraft assignments, and operational status.',2);
insTbl.run('DUTY_LOG','Records crew duty periods, rest times, and compliance with flight time limitations.',1);
insTbl.run('AIRCRAFT_STATUS','Current status of each aircraft including serviceability, location, and next maintenance due.',3);
insTbl.run('TICKET_SALES','Transaction records for all ticket sales including fare class, payment method, and PNR reference.',4);
insTbl.run('ROUTE_MASTER','Master table of all routes with distance, sector times, and fuel burn profiles.',2);
insTbl.run('MAINT_DEFECTS','Defect reports logged by crew and engineers with severity, status, and resolution details.',3);
insTbl.run('REVENUE_JOURNAL','Financial journal entries for revenue recognition and interline settlement.',4);

// Programs
const insProg = db.prepare(`INSERT OR IGNORE INTO programs (name,description,business_logic) VALUES (?,?,?)`);
insProg.run('CRWASN01','Crew assignment program','Reads the flight schedule and crew roster to automatically assign qualified crew members to flights based on their qualifications, base location, and duty time remaining.');
insProg.run('FLTPLN01','Flight plan generator','Takes route master data and aircraft status to generate optimized flight plans with fuel calculations, alternate airports, and weather considerations.');
insProg.run('DUTYCK01','Duty time compliance checker','Scans duty logs against regulatory limits to flag any crew members approaching maximum flight time or minimum rest violations.');
insProg.run('MNTSCH01','Maintenance scheduler','Reads aircraft status and defect reports to schedule maintenance tasks, ensuring aircraft remain airworthy and compliant with maintenance programs.');
insProg.run('TKTREV01','Ticket revenue processor','Processes ticket sales transactions, applies fare rules, calculates taxes, and posts revenue journal entries for financial reporting.');
insProg.run('DEFLOG01','Defect logging program','Allows engineers and crew to log aircraft defects with severity classification. Updates aircraft status if defect affects serviceability.');

// Program-Application links
const insPA = db.prepare(`INSERT OR IGNORE INTO program_application_links (program_id,application_id) VALUES (?,?)`);
insPA.run(1,1); // CRWASN01 -> Crew Management
insPA.run(2,2); // FLTPLN01 -> Flight Planning
insPA.run(3,1); // DUTYCK01 -> Crew Management
insPA.run(4,3); // MNTSCH01 -> Maintenance Control
insPA.run(5,4); // TKTREV01 -> Revenue Accounting
insPA.run(6,3); // DEFLOG01 -> Maintenance Control

// Program-Table links
const insPT = db.prepare(`INSERT OR IGNORE INTO program_table_links (program_id,table_id,direction) VALUES (?,?,?)`);
// CRWASN01 reads CREW_ROSTER(1), FLIGHT_SCHEDULE(2); writes CREW_ROSTER(1), DUTY_LOG(3)
insPT.run(1,1,'READ');insPT.run(1,2,'READ');insPT.run(1,1,'WRITE');insPT.run(1,3,'WRITE');
// FLTPLN01 reads ROUTE_MASTER(6), AIRCRAFT_STATUS(4); writes FLIGHT_SCHEDULE(2)
insPT.run(2,6,'READ');insPT.run(2,4,'READ');insPT.run(2,2,'WRITE');
// DUTYCK01 reads DUTY_LOG(3), CREW_ROSTER(1); writes DUTY_LOG(3)
insPT.run(3,3,'READ');insPT.run(3,1,'READ');insPT.run(3,3,'WRITE');
// MNTSCH01 reads AIRCRAFT_STATUS(4), MAINT_DEFECTS(7); writes AIRCRAFT_STATUS(4)
insPT.run(4,4,'READ');insPT.run(4,7,'READ');insPT.run(4,4,'WRITE');
// TKTREV01 reads TICKET_SALES(5); writes REVENUE_JOURNAL(8)
insPT.run(5,5,'READ');insPT.run(5,8,'WRITE');
// DEFLOG01 reads AIRCRAFT_STATUS(4); writes MAINT_DEFECTS(7), AIRCRAFT_STATUS(4)
insPT.run(6,4,'READ');insPT.run(6,7,'WRITE');insPT.run(6,4,'WRITE');

// Business Roles
const insRole = db.prepare(`INSERT OR IGNORE INTO business_roles (name,description) VALUES (?,?)`);
insRole.run('MCC','Mainframe Control Centre - monitors all operational systems, handles real-time disruptions, and coordinates between crew, maintenance, and flight planning.');
insRole.run('Planner','Flight and crew planners who create schedules, optimize routes, and ensure adequate crew coverage for all operations.');
insRole.run('AMT','Aircraft Maintenance Technician - responsible for aircraft inspections, defect rectification, and maintenance documentation.');
insRole.run('Cabin Crew','Flight attendants who view their roster assignments, report duty times, and log cabin defects.');
insRole.run('Revenue Analyst','Analyzes ticket sales data, monitors revenue performance, and manages interline billing processes.');

// Role-Application links
const insRA = db.prepare(`INSERT OR IGNORE INTO role_application_links (role_id,application_id) VALUES (?,?)`);
insRA.run(1,1);insRA.run(1,2);insRA.run(1,3); // MCC
insRA.run(2,1);insRA.run(2,2);                 // Planner
insRA.run(3,3);                                 // AMT
insRA.run(4,1);                                 // Cabin Crew
insRA.run(5,4);                                 // Revenue Analyst

// Role-Program links
const insRP = db.prepare(`INSERT OR IGNORE INTO role_program_links (role_id,program_id) VALUES (?,?)`);
insRP.run(1,1);insRP.run(1,2);insRP.run(1,3);insRP.run(1,4); // MCC
insRP.run(2,1);insRP.run(2,2);insRP.run(2,3);                 // Planner
insRP.run(3,4);insRP.run(3,6);                                 // AMT
insRP.run(4,3);insRP.run(4,6);                                 // Cabin Crew
insRP.run(5,5);                                                 // Revenue Analyst
