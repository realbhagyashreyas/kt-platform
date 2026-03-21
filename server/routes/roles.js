const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const roles = db.prepare('SELECT * FROM business_roles ORDER BY name').all();
  for (const r of roles) {
    r.applications = db.prepare(`
      SELECT a.id, a.name FROM applications a
      JOIN role_application_links ral ON a.id = ral.application_id WHERE ral.role_id = ?
    `).all(r.id);
    r.programs = db.prepare(`
      SELECT p.id, p.name FROM programs p
      JOIN role_program_links rpl ON p.id = rpl.program_id WHERE rpl.role_id = ?
    `).all(r.id);
  }
  res.json(roles);
});

router.get('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM business_roles WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.applications = db.prepare(`
    SELECT a.* FROM applications a
    JOIN role_application_links ral ON a.id = ral.application_id WHERE ral.role_id = ?
  `).all(r.id);
  r.programs = db.prepare(`
    SELECT p.* FROM programs p
    JOIN role_program_links rpl ON p.id = rpl.program_id WHERE rpl.role_id = ?
  `).all(r.id);
  res.json(r);
});

router.post('/', (req, res) => {
  const { name, description, application_ids, program_ids } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = db.prepare('INSERT INTO business_roles (name, description) VALUES (?, ?)').run(name, description || '');
    const rid = result.lastInsertRowid;
    const insApp = db.prepare('INSERT OR IGNORE INTO role_application_links (role_id, application_id) VALUES (?, ?)');
    const insProg = db.prepare('INSERT OR IGNORE INTO role_program_links (role_id, program_id) VALUES (?, ?)');
    if (application_ids) for (const aid of application_ids) { if (aid) insApp.run(rid, aid); }
    if (program_ids) for (const pid of program_ids) { if (pid) insProg.run(rid, pid); }
    res.status(201).json({ id: rid, name });
  } catch (e) {
    res.status(409).json({ error: 'Role already exists' });
  }
});

router.put('/:id', (req, res) => {
  const { name, description, application_ids, program_ids } = req.body;
  db.prepare('UPDATE business_roles SET name=?, description=? WHERE id=?').run(name, description, req.params.id);
  db.prepare('DELETE FROM role_application_links WHERE role_id=?').run(req.params.id);
  db.prepare('DELETE FROM role_program_links WHERE role_id=?').run(req.params.id);
  const insApp = db.prepare('INSERT OR IGNORE INTO role_application_links (role_id, application_id) VALUES (?, ?)');
  const insProg = db.prepare('INSERT OR IGNORE INTO role_program_links (role_id, program_id) VALUES (?, ?)');
  if (application_ids) for (const aid of application_ids) { if (aid) insApp.run(req.params.id, aid); }
  if (program_ids) for (const pid of program_ids) { if (pid) insProg.run(req.params.id, pid); }
  res.json({ id: Number(req.params.id), name });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM business_roles WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
