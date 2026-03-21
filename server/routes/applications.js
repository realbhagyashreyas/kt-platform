const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const apps = db.prepare('SELECT * FROM applications ORDER BY name').all();
  for (const a of apps) {
    a.programs = db.prepare('SELECT id, name FROM programs WHERE application_id = ?').all(a.id);
    a.tables = db.prepare('SELECT id, name FROM db2_tables WHERE application_id = ?').all(a.id);
    a.roles = db.prepare(`
      SELECT br.id, br.name FROM business_roles br
      JOIN role_application_links ral ON br.id = ral.role_id WHERE ral.application_id = ?
    `).all(a.id);
  }
  res.json(apps);
});

router.get('/:id', (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Not found' });
  app.programs = db.prepare('SELECT * FROM programs WHERE application_id = ?').all(app.id);
  app.tables = db.prepare('SELECT * FROM db2_tables WHERE application_id = ?').all(app.id);
  app.roles = db.prepare(`
    SELECT br.* FROM business_roles br
    JOIN role_application_links ral ON br.id = ral.role_id WHERE ral.application_id = ?
  `).all(app.id);
  res.json(app);
});

router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = db.prepare('INSERT INTO applications (name, description) VALUES (?, ?)').run(name, description || '');
    res.status(201).json({ id: result.lastInsertRowid, name, description });
  } catch (e) {
    res.status(409).json({ error: 'Application already exists' });
  }
});

router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  db.prepare('UPDATE applications SET name = ?, description = ? WHERE id = ?').run(name, description, req.params.id);
  res.json({ id: Number(req.params.id), name, description });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM applications WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
