const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const apps = db.prepare('SELECT id, name, description FROM applications').all();
  const programs = db.prepare('SELECT id, name, description, business_logic, application_id FROM programs').all();
  const tables = db.prepare('SELECT id, name, description, application_id FROM db2_tables').all();
  const roles = db.prepare('SELECT id, name, description FROM business_roles').all();
  const ptLinks = db.prepare('SELECT program_id, table_id, direction FROM program_table_links').all();
  const raLinks = db.prepare('SELECT role_id, application_id FROM role_application_links').all();
  const rpLinks = db.prepare('SELECT role_id, program_id FROM role_program_links').all();
  const paLinks = db.prepare('SELECT program_id, application_id FROM program_application_links').all();
  const ppLinks = db.prepare('SELECT source_program_id, target_program_id FROM program_program_links').all();

  const nodes = [];
  const edges = [];

  for (const r of roles) nodes.push({ id: `role-${r.id}`, type: 'role', label: r.name, entityId: r.id, description: r.description });
  for (const a of apps) nodes.push({ id: `app-${a.id}`, type: 'app', label: a.name, entityId: a.id, description: a.description });
  for (const p of programs) {
    nodes.push({ id: `prog-${p.id}`, type: 'program', label: p.name, entityId: p.id, description: p.description });
    if (p.application_id && !paLinks.some(l => l.program_id === p.id)) {
      edges.push({ source: `prog-${p.id}`, target: `app-${p.application_id}`, label: 'BELONGS TO' });
    }
  }
  for (const t of tables) nodes.push({ id: `table-${t.id}`, type: 'table', label: t.name, entityId: t.id, description: t.description });

  for (const l of raLinks) edges.push({ source: `role-${l.role_id}`, target: `app-${l.application_id}`, label: 'USES' });
  for (const l of rpLinks) edges.push({ source: `role-${l.role_id}`, target: `prog-${l.program_id}`, label: 'USES' });
  for (const l of paLinks) edges.push({ source: `prog-${l.program_id}`, target: `app-${l.application_id}`, label: 'BELONGS TO' });
  for (const l of ppLinks) edges.push({ source: `prog-${l.source_program_id}`, target: `prog-${l.target_program_id}`, label: 'CALLS' });
  for (const l of ptLinks) {
    if (l.direction === 'READ') edges.push({ source: `prog-${l.program_id}`, target: `table-${l.table_id}`, label: 'READS' });
    else edges.push({ source: `prog-${l.program_id}`, target: `table-${l.table_id}`, label: 'WRITES' });
  }

  res.json({ nodes, edges });
});

router.get('/search', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const results = [
    ...db.prepare("SELECT id, name, 'role' as type FROM business_roles WHERE name LIKE ?").all(q),
    ...db.prepare("SELECT id, name, 'application' as type FROM applications WHERE name LIKE ?").all(q),
    ...db.prepare("SELECT id, name, 'program' as type FROM programs WHERE name LIKE ?").all(q),
    ...db.prepare("SELECT id, name, 'table' as type FROM db2_tables WHERE name LIKE ?").all(q),
  ];
  res.json(results);
});

router.get('/explore/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const result = { entity: null, connected: [] };

  if (type === 'role') {
    result.entity = db.prepare("SELECT *, 'role' as type FROM business_roles WHERE id = ?").get(id);
    const apps = db.prepare(`SELECT a.id, a.name, a.description, 'application' as type, 'USES' as relation
      FROM applications a JOIN role_application_links ral ON a.id = ral.application_id WHERE ral.role_id = ?`).all(id);
    const progs = db.prepare(`SELECT p.id, p.name, p.description, p.business_logic, 'program' as type, 'USES' as relation
      FROM programs p JOIN role_program_links rpl ON p.id = rpl.program_id WHERE rpl.role_id = ?`).all(id);
    result.connected = [...apps, ...progs];
  } else if (type === 'application' || type === 'app') {
    result.entity = db.prepare("SELECT *, 'application' as type FROM applications WHERE id = ?").get(id);
    const progs = db.prepare(`SELECT p.id, p.name, p.description, p.business_logic, 'program' as type, 'BELONGS TO' as relation
      FROM programs p JOIN program_application_links pal ON p.id = pal.program_id WHERE pal.application_id = ?`).all(id);
    const legacyProgs = db.prepare(`SELECT id, name, description, business_logic, 'program' as type, 'BELONGS TO' as relation
      FROM programs WHERE application_id = ? AND id NOT IN (SELECT program_id FROM program_application_links)`).all(id);
    const tbls = db.prepare(`SELECT id, name, description, 'table' as type, 'BELONGS TO' as relation
      FROM db2_tables WHERE application_id = ?`).all(id);
    const roles = db.prepare(`SELECT br.id, br.name, br.description, 'role' as type, 'USED BY' as relation
      FROM business_roles br JOIN role_application_links ral ON br.id = ral.role_id WHERE ral.application_id = ?`).all(id);
    result.connected = [...progs, ...legacyProgs, ...tbls, ...roles];
  } else if (type === 'program' || type === 'prog') {
    result.entity = db.prepare("SELECT p.*, 'program' as type FROM programs p WHERE p.id = ?").get(id);
    const progApps = db.prepare(`SELECT a.id, a.name, a.description, 'application' as type, 'BELONGS TO' as relation
      FROM applications a JOIN program_application_links pal ON a.id = pal.application_id WHERE pal.program_id = ?`).all(id);
    if (progApps.length === 0 && result.entity && result.entity.application_id) {
      const la = db.prepare(`SELECT id, name, description, 'application' as type, 'BELONGS TO' as relation FROM applications WHERE id = ?`).get(result.entity.application_id);
      if (la) progApps.push(la);
    }
    const reads = db.prepare(`SELECT t.id, t.name, t.description, 'table' as type, 'READS' as relation
      FROM db2_tables t JOIN program_table_links ptl ON t.id = ptl.table_id WHERE ptl.program_id = ? AND ptl.direction = 'READ'`).all(id);
    const writes = db.prepare(`SELECT t.id, t.name, t.description, 'table' as type, 'WRITES' as relation
      FROM db2_tables t JOIN program_table_links ptl ON t.id = ptl.table_id WHERE ptl.program_id = ? AND ptl.direction = 'WRITE'`).all(id);
    const roles = db.prepare(`SELECT br.id, br.name, br.description, 'role' as type, 'USED BY' as relation
      FROM business_roles br JOIN role_program_links rpl ON br.id = rpl.role_id WHERE rpl.program_id = ?`).all(id);
    const linkedProgs = db.prepare(`SELECT p2.id, p2.name, p2.description, 'program' as type, 'CALLS' as relation
      FROM programs p2 JOIN program_program_links ppl ON p2.id = ppl.target_program_id WHERE ppl.source_program_id = ?`).all(id);
    const calledBy = db.prepare(`SELECT p2.id, p2.name, p2.description, 'program' as type, 'CALLED BY' as relation
      FROM programs p2 JOIN program_program_links ppl ON p2.id = ppl.source_program_id WHERE ppl.target_program_id = ?`).all(id);
    result.connected = [...progApps, ...reads, ...writes, ...roles, ...linkedProgs, ...calledBy];
  } else if (type === 'table') {
    result.entity = db.prepare("SELECT t.*, a.name as application_name, 'table' as type FROM db2_tables t LEFT JOIN applications a ON t.application_id = a.id WHERE t.id = ?").get(id);
    const readers = db.prepare(`SELECT p.id, p.name, p.description, 'program' as type, 'READ BY' as relation
      FROM programs p JOIN program_table_links ptl ON p.id = ptl.program_id WHERE ptl.table_id = ? AND ptl.direction = 'READ'`).all(id);
    const writers = db.prepare(`SELECT p.id, p.name, p.description, 'program' as type, 'WRITTEN BY' as relation
      FROM programs p JOIN program_table_links ptl ON p.id = ptl.program_id WHERE ptl.table_id = ? AND ptl.direction = 'WRITE'`).all(id);
    result.connected = [...readers, ...writers];
  }

  res.json(result);
});

module.exports = router;
