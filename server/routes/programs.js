const express = require('express');
const router = express.Router();
const db = require('../db');

function getApps(pid, legacyAppId) {
  const apps = db.prepare(`SELECT a.id, a.name FROM applications a
    JOIN program_application_links pal ON a.id = pal.application_id WHERE pal.program_id = ?`).all(pid);
  if (apps.length === 0 && legacyAppId) {
    const a = db.prepare('SELECT id, name FROM applications WHERE id = ?').get(legacyAppId);
    if (a) return [a];
  }
  return apps;
}

router.get('/', (req, res) => {
  const programs = db.prepare('SELECT * FROM programs ORDER BY name').all();
  for (const p of programs) {
    p.applications = getApps(p.id, p.application_id);
    p.linked_programs = db.prepare(`SELECT p2.id, p2.name FROM programs p2
      JOIN program_program_links ppl ON p2.id = ppl.target_program_id WHERE ppl.source_program_id = ?`).all(p.id);
    p.read_tables = db.prepare(`SELECT t.id, t.name FROM db2_tables t
      JOIN program_table_links ptl ON t.id = ptl.table_id
      WHERE ptl.program_id = ? AND ptl.direction = 'READ'`).all(p.id);
    p.write_tables = db.prepare(`SELECT t.id, t.name FROM db2_tables t
      JOIN program_table_links ptl ON t.id = ptl.table_id
      WHERE ptl.program_id = ? AND ptl.direction = 'WRITE'`).all(p.id);
  }
  res.json(programs);
});

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.applications = getApps(p.id, p.application_id);
  p.linked_programs = db.prepare(`SELECT p2.id, p2.name FROM programs p2
    JOIN program_program_links ppl ON p2.id = ppl.target_program_id WHERE ppl.source_program_id = ?`).all(p.id);
  p.read_tables = db.prepare(`SELECT t.* FROM db2_tables t JOIN program_table_links ptl ON t.id = ptl.table_id
    WHERE ptl.program_id = ? AND ptl.direction = 'READ'`).all(p.id);
  p.write_tables = db.prepare(`SELECT t.* FROM db2_tables t JOIN program_table_links ptl ON t.id = ptl.table_id
    WHERE ptl.program_id = ? AND ptl.direction = 'WRITE'`).all(p.id);
  p.roles = db.prepare(`SELECT br.id, br.name FROM business_roles br
    JOIN role_program_links rpl ON br.id = rpl.role_id WHERE rpl.program_id = ?`).all(p.id);
  res.json(p);
});

router.post('/', (req, res) => {
  const { name, description, business_logic, application_ids, linked_program_ids, read_tables, write_tables } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = db.prepare('INSERT INTO programs (name, description, business_logic) VALUES (?, ?, ?)')
      .run(name, description || '', business_logic || '');
    const pid = result.lastInsertRowid;
    const insA = db.prepare('INSERT OR IGNORE INTO program_application_links (program_id, application_id) VALUES (?, ?)');
    if (application_ids) for (const aid of application_ids) { if (aid) insA.run(pid, aid); }
    const insP = db.prepare('INSERT OR IGNORE INTO program_program_links (source_program_id, target_program_id) VALUES (?, ?)');
    if (linked_program_ids) for (const lpid of linked_program_ids) { if (lpid && lpid !== pid) insP.run(pid, lpid); }
    const insT = db.prepare('INSERT OR IGNORE INTO program_table_links (program_id, table_id, direction) VALUES (?, ?, ?)');
    if (read_tables) for (const tid of read_tables) { if (tid) insT.run(pid, tid, 'READ'); }
    if (write_tables) for (const tid of write_tables) { if (tid) insT.run(pid, tid, 'WRITE'); }
    res.status(201).json({ id: pid, name });
  } catch (e) {
    res.status(409).json({ error: 'Program already exists' });
  }
});

router.put('/:id', (req, res) => {
  const { name, description, business_logic, application_ids, linked_program_ids, read_tables, write_tables } = req.body;
  db.prepare('UPDATE programs SET name=?, description=?, business_logic=? WHERE id=?')
    .run(name, description, business_logic, req.params.id);
  db.prepare('DELETE FROM program_application_links WHERE program_id = ?').run(req.params.id);
  const insA = db.prepare('INSERT OR IGNORE INTO program_application_links (program_id, application_id) VALUES (?, ?)');
  if (application_ids) for (const aid of application_ids) { if (aid) insA.run(req.params.id, aid); }
  db.prepare('DELETE FROM program_program_links WHERE source_program_id = ?').run(req.params.id);
  const insP = db.prepare('INSERT OR IGNORE INTO program_program_links (source_program_id, target_program_id) VALUES (?, ?)');
  if (linked_program_ids) for (const lpid of linked_program_ids) { if (lpid && lpid !== Number(req.params.id)) insP.run(req.params.id, lpid); }
  db.prepare('DELETE FROM program_table_links WHERE program_id = ?').run(req.params.id);
  const insT = db.prepare('INSERT OR IGNORE INTO program_table_links (program_id, table_id, direction) VALUES (?, ?, ?)');
  if (read_tables) for (const tid of read_tables) { if (tid) insT.run(req.params.id, tid, 'READ'); }
  if (write_tables) for (const tid of write_tables) { if (tid) insT.run(req.params.id, tid, 'WRITE'); }
  res.json({ id: Number(req.params.id), name });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM programs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
