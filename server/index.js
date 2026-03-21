const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/graph', require('./routes/graph'));
app.use('/api/upload', require('./routes/upload'));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Auto-seed if DB is empty (first deploy)
const db = require('./db');
const accountCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;
if (accountCount === 0) {
  console.log('Empty DB detected — seeding initial data...');
  require('./seed-db');
  console.log('Seed complete.');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KT Server running on http://localhost:${PORT}`));
