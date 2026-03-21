const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const tables = db.prepare(`
    SELECT t.*, a.name as application_name FROM db2_tables t
    LEFT JOIN applications a ON t.application_id = a.id ORDER BY t.name
  `).all();
  for (const t of tables) {
    t.read_by = db.prepare(`
      SELECT p.id, p.name FROM programs p JOIN program_table_links ptl ON p.id = ptl.program_id
      WHERE ptl.table_id = ? AND ptl.direction = 'READ'
    `).all(t.id);
    t.written_by = db.prepare(`
      SELECT p.id, p.name FROM programs p JOIN program_table_links ptl ON p.id = ptl.program_id
      WHERE ptl.table_id = ? AND ptl.direction = 'WRITE'
    `).all(t.id);
  }
  res.json(tables);
});

router.get('/:id', (req, res) => {
  const t = db.prepare(`
    SELECT t.*, a.name as application_name FROM db2_tables t
    LEFT JOIN applications a ON t.application_id = a.id WHERE t.id = ?
  `).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  t.read_by = db.prepare(`
    SELECT p.* FROM programs p JOIN program_table_links ptl ON p.id = ptl.program_id
    WHERE ptl.table_id = ? AND ptl.direction = 'READ'
  `).all(t.id);
  t.written_by = db.prepare(`
    SELECT p.* FROM programs p JOIN program_table_links ptl ON p.id = ptl.program_id
    WHERE ptl.table_id = ? AND ptl.direction = 'WRITE'
  `).all(t.id);
  res.json(t);
});

router.post('/', (req, res) => {
  const { name, description, application_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = db.prepare('INSERT INTO db2_tables (name, description, application_id) VALUES (?, ?, ?)')
      .run(name, description || '', application_id || null);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (e) {
    res.status(409).json({ error: 'Table already exists' });
  }
});

router.put('/:id', (req, res) => {
  const { name, description, application_id } = req.body;
  db.prepare('UPDATE db2_tables SET name=?, description=?, application_id=? WHERE id=?')
    .run(name, description, application_id || null, req.params.id);
  res.json({ id: Number(req.params.id), name });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM db2_tables WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
