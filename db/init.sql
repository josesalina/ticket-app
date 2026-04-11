CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  prefix VARCHAR(4) NOT NULL,
  path VARCHAR(500) DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  key VARCHAR(20) UNIQUE NOT NULL,
  project_id INTEGER REFERENCES projects(id),
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('backlog','todo','in_progress','review','done','blocked')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  assignee VARCHAR(100) DEFAULT '',
  labels TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_logs (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  hours DECIMAL(5,2) NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_project ON tickets(project_id);
