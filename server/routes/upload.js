const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../db');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const entityType = req.body.type;
  if (!entityType) return res.status(400).json({ error: 'Entity type is required' });

  try {
    const content = req.file.buffer.toString('utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    let count = 0;

    if (entityType === 'applications') {
      const stmt = db.prepare('INSERT OR IGNORE INTO applications (name, description) VALUES (?, ?)');
      for (const r of records) { if (r.name) { stmt.run(r.name, r.description || ''); count++; } }
    } else if (entityType === 'db2_tables') {
      for (const r of records) {
        if (!r.name) continue;
        let appId = null;
        if (r.application) { const a = db.prepare('SELECT id FROM applications WHERE name = ?').get(r.application); appId = a ? a.id : null; }
        db.prepare('INSERT OR IGNORE INTO db2_tables (name, description, application_id) VALUES (?, ?, ?)').run(r.name, r.description || '', appId);
        count++;
      }
    } else if (entityType === 'programs') {
      for (const r of records) {
        if (!r.name) continue;
        const result = db.prepare('INSERT OR IGNORE INTO programs (name, description, business_logic) VALUES (?, ?, ?)')
          .run(r.name, r.description || '', r.business_logic || '');
        if (result.changes > 0) {
          const pid = result.lastInsertRowid;
          if (r.applications) for (const an of r.applications.split(';')) {
            const a = db.prepare('SELECT id FROM applications WHERE name = ?').get(an.trim());
            if (a) db.prepare('INSERT OR IGNORE INTO program_application_links (program_id, application_id) VALUES (?, ?)').run(pid, a.id);
          }
          if (r.read_tables) for (const tn of r.read_tables.split(';')) {
            const t = db.prepare('SELECT id FROM db2_tables WHERE name = ?').get(tn.trim());
            if (t) db.prepare('INSERT OR IGNORE INTO program_table_links (program_id, table_id, direction) VALUES (?, ?, ?)').run(pid, t.id, 'READ');
          }
          if (r.write_tables) for (const tn of r.write_tables.split(';')) {
            const t = db.prepare('SELECT id FROM db2_tables WHERE name = ?').get(tn.trim());
            if (t) db.prepare('INSERT OR IGNORE INTO program_table_links (program_id, table_id, direction) VALUES (?, ?, ?)').run(pid, t.id, 'WRITE');
          }
        }
        count++;
      }
    } else if (entityType === 'roles') {
      for (const r of records) {
        if (!r.name) continue;
        const result = db.prepare('INSERT OR IGNORE INTO business_roles (name, description) VALUES (?, ?)').run(r.name, r.description || '');
        if (result.changes > 0) {
          const rid = result.lastInsertRowid;
          if (r.applications) for (const an of r.applications.split(';')) {
            const a = db.prepare('SELECT id FROM applications WHERE name = ?').get(an.trim());
            if (a) db.prepare('INSERT OR IGNORE INTO role_application_links (role_id, application_id) VALUES (?, ?)').run(rid, a.id);
          }
          if (r.programs) for (const pn of r.programs.split(';')) {
            const p = db.prepare('SELECT id FROM programs WHERE name = ?').get(pn.trim());
            if (p) db.prepare('INSERT OR IGNORE INTO role_program_links (role_id, program_id) VALUES (?, ?)').run(rid, p.id);
          }
        }
        count++;
      }
    } else {
      return res.status(400).json({ error: 'Invalid entity type' });
    }
    res.json({ success: true, imported: count });
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse CSV: ' + e.message });
  }
});

module.exports = router;
