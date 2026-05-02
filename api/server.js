const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tickets',
  user: process.env.DB_USER || 'tickets',
  password: process.env.DB_PASS || 'tickets123',
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Projects
app.get('/api/projects', async (req, res) => {
  const { rows } = await pool.query('SELECT p.*, COUNT(t.id) as ticket_count FROM projects p LEFT JOIN tickets t ON t.project_id = p.id GROUP BY p.id ORDER BY p.name');
  res.json(rows);
});

app.post('/api/projects', async (req, res) => {
  const { name, path: projPath } = req.body;
  const prefix = name.toUpperCase().slice(0, 4);
  try {
    const { rows } = await pool.query('INSERT INTO projects (name, prefix, path) VALUES ($1, $2, $3) RETURNING *', [name, prefix, projPath || '']);
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      const { rows } = await pool.query('SELECT * FROM projects WHERE name = $1', [name]);
      res.json(rows[0]);
    } else { res.status(500).json({ error: e.message }); }
  }
});

app.put('/api/projects/:id', async (req, res) => {
  const { path: projPath } = req.body;
  try {
    const { rows } = await pool.query('UPDATE projects SET path = $1 WHERE id = $2 RETURNING *', [projPath || '', req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Tickets
app.get('/api/tickets', async (req, res) => {
  const { project, status } = req.query;
  let q = `SELECT t.*, p.name as project, p.prefix,
    COALESCE((SELECT json_agg(json_build_object('id',c.id,'text',c.text,'date',c.created_at) ORDER BY c.created_at) FROM comments c WHERE c.ticket_id = t.id), '[]') as comments,
    COALESCE((SELECT json_agg(json_build_object('id',w.id,'hours',w.hours,'note',w.note,'date',w.created_at) ORDER BY w.created_at) FROM work_logs w WHERE w.ticket_id = t.id), '[]') as work_log
    FROM tickets t JOIN projects p ON t.project_id = p.id`;
  const where = [], params = [];
  if (project) { params.push(project); where.push(`p.name = $${params.length}`); }
  if (status) { params.push(status); where.push(`t.status = $${params.length}`); }
  if (where.length) q += ' WHERE ' + where.join(' AND ');
  q += ' ORDER BY t.id DESC';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

app.get('/api/tickets/:id', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT t.*, p.name as project, p.prefix,
      COALESCE((SELECT json_agg(json_build_object('id',c.id,'text',c.text,'date',c.created_at) ORDER BY c.created_at) FROM comments c WHERE c.ticket_id = t.id), '[]') as comments,
      COALESCE((SELECT json_agg(json_build_object('id',w.id,'hours',w.hours,'note',w.note,'date',w.created_at) ORDER BY w.created_at) FROM work_logs w WHERE w.ticket_id = t.id), '[]') as work_log
    FROM tickets t JOIN projects p ON t.project_id = p.id
    WHERE t.id = $1
  `, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

app.post('/api/tickets', async (req, res) => {
  const { project, project_id, title, description, priority, assignee, project_path, status } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  // Resolve project: accept either project_id (number) or project (name string)
  let projRow;
  if (project_id != null) {
    const found = await pool.query('SELECT * FROM projects WHERE id = $1', [project_id]);
    if (!found.rows.length) {
      return res.status(400).json({ error: `project_id ${project_id} not found` });
    }
    projRow = found.rows[0];
  } else {
    if (typeof project !== 'string' || !project.trim()) {
      return res.status(400).json({ error: 'project (name) or project_id is required' });
    }
    const projectName = project.trim();
    const existing = await pool.query('SELECT * FROM projects WHERE name = $1', [projectName]);
    if (existing.rows.length) {
      projRow = existing.rows[0];
    } else {
      const prefix = projectName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'PROJ';
      const created = await pool.query('INSERT INTO projects (name, prefix, path) VALUES ($1, $2, $3) RETURNING *', [projectName, prefix, project_path || '']);
      projRow = created.rows[0];
    }
  }
  // Get next ticket number for this project
  const countRes = await pool.query('SELECT COUNT(*) as cnt FROM tickets WHERE project_id = $1', [projRow.id]);
  const num = parseInt(countRes.rows[0].cnt) + 1;
  const key = `${projRow.prefix}-${num}`;
  const { rows } = await pool.query(
    'INSERT INTO tickets (key, project_id, title, description, priority, assignee, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [key, projRow.id, title, description || '', priority || 'medium', assignee || '', status || 'todo']
  );
  const ticket = { ...rows[0], project: projRow.name, comments: [], work_log: [] };
  res.json(ticket);
});

app.put('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const sets = [], params = [];
  for (const [k, v] of Object.entries(fields)) {
    if (['title','description','status','priority','assignee'].includes(k)) {
      params.push(v);
      sets.push(`${k} = $${params.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
  sets.push('updated_at = NOW()');
  params.push(id);
  const { rows } = await pool.query(`UPDATE tickets SET ${sets.join(',')} WHERE id = $${params.length} RETURNING *`, params);
  res.json(rows[0]);
});

app.delete('/api/tickets/:id', async (req, res) => {
  await pool.query('DELETE FROM tickets WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// Comments
app.post('/api/tickets/:id/comments', async (req, res) => {
  const { text } = req.body;
  const { rows } = await pool.query('INSERT INTO comments (ticket_id, text) VALUES ($1, $2) RETURNING *', [req.params.id, text]);
  res.json(rows[0]);
});

// Work logs
app.post('/api/tickets/:id/log', async (req, res) => {
  const { hours, note } = req.body;
  const { rows } = await pool.query('INSERT INTO work_logs (ticket_id, hours, note) VALUES ($1, $2, $3) RETURNING *', [req.params.id, hours, note]);
  res.json(rows[0]);
});

// Summary
app.get('/api/summary', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT status, COUNT(*) as count FROM tickets GROUP BY status
    UNION ALL
    SELECT 'total', COUNT(*) FROM tickets
  `);
  res.json(rows);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`API running on :${PORT}`));
