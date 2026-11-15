-- SQLite-ready schema for a production deployment.
CREATE TABLE stops (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, lat REAL, lng REAL);
CREATE TABLE routes (
  id TEXT PRIMARY KEY, number TEXT NOT NULL, origin_stop_id TEXT NOT NULL REFERENCES stops(id),
  destination_stop_id TEXT NOT NULL REFERENCES stops(id), first_service TEXT, last_service TEXT,
  headway_minutes INTEGER, estimated_duration_minutes INTEGER, category TEXT, color TEXT,
  source_note TEXT NOT NULL DEFAULT 'Planning estimate; verify with operator'
);
CREATE TABLE route_stops (
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_id TEXT NOT NULL REFERENCES stops(id), sequence INTEGER NOT NULL,
  PRIMARY KEY (route_id, sequence)
);
CREATE TABLE service_updates (
  id TEXT PRIMARY KEY, route_id TEXT REFERENCES routes(id), message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
