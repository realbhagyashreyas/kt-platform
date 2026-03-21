const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const programs = db.prepare(`
    SELECT p.*, a.name as application_name FROM programs p
    LEFT JOIN applications a ON p.application_id = a.id ORDER BY p.name
  `).all();
  for (const p of programs) {
    p.read_tables = db.prepare(`
      SELECT t.id, t.name FROM db2_tables t
      JOIN program_table_links ptl ON t.id = ptl.table_id
      WHERE ptl.program_id = ? AND ptl.direction = 'READ'
    `).all(p.id);
    p.write_tables = db.prepare(`
      SELECT t.id, t.name FROM db2_tables t
      JOIN program_table_links ptl ON t.id = ptl.table_id
      WHERE ptl.program_id = ? AND ptl.direction = 'WRITE'
    `).all(p.id);
  }
  res.json(programs);
});

router.get('/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, a.name as application_name FROM programs p
    LEFT JOIN applications a ON p.application_id = a.id WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.read_tables = db.prepare(`
    SELECT t.* FROM db2_tables t JOIN program_table_links ptl ON t.id = ptl.table_id
    WHERE ptl.program_id = ? AND ptl.direction = 'READ'
  `).all(p.id);
  p.write_tables = db.prepare(`
    SELECT t.* FROM db2_tables t JOIN program_table_links ptl ON t.id = ptl.table_id
    WHERE ptl.program_id = ? AND ptl.direction = 'WRITE'
  `).all(p.id);
  p.roles = db.prepare(`
    SELECT br.id, br.name FROM business_roles br
    JOIN role_program_links rpl ON br.id = rpl.role_id WHERE rpl.program_id = ?
  `).all(p.id);
  res.json(p);
});

router.post('/', (req, res) => {
  const { name, description, business_logic, application_id, read_tables, write_tables } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = db.prepare(
      'INSERT INTO programs (name, description, business_logic, application_id) VALUES (?, ?, ?, ?)'
    ).run(name, description || '', business_logic || '', application_id || null);
    const pid = result.lastInsertRowid;
    const ins = db.prepare('INSERT OR IGNORE INTO program_table_links (program_id, table_id, direction) VALUES (?, ?, ?)');
    if (read_tables) for (const tid of read_tables) { if (tid) ins.run(pid, tid, 'READ'); }
    if (write_tables) for (const tid of write_tables) { if (tid) ins.run(pid, tid, 'WRITE'); }
    res.status(201).json({ id: pid, name });
  } catch (e) {
    res.status(409).json({ error: 'Program already exists' });
  }
});

router.put('/:id', (req, res) => {
  const { name, description, business_logic, application_id, read_tables, write_tables } = req.body;
  db.prepare('UPDATE programs SET name=?, description=?, business_logic=?, application_id=? WHERE id=?')
    .run(name, description, business_logic, application_id || null, req.params.id);
  db.prepare('DELETE FROM program_table_links WHERE program_id = ?').run(req.params.id);
  const ins = db.prepare('INSERT OR IGNORE INTO program_table_links (program_id, table_id, direction) VALUES (?, ?, ?)');
  if (read_tables) for (const tid of read_tables) { if (tid) ins.run(req.params.id, tid, 'READ'); }
  if (write_tables) for (const tid of write_tables) { if (tid) ins.run(req.params.id, tid, 'WRITE'); }
  res.json({ id: Number(req.params.id), name });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM programs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
