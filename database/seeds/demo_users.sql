-- Development-only accounts. The password for every account is: pass123
-- pgcrypto produces bcrypt-compatible hashes; plaintext passwords are never stored.

INSERT INTO users (username, password_hash, role)
VALUES
  ('investigator1', crypt('pass123', gen_salt('bf', 10)), 'investigator'),
  ('investigator2', crypt('pass123', gen_salt('bf', 10)), 'investigator'),
  ('clerk1', crypt('pass123', gen_salt('bf', 10)), 'court_clerk'),
  ('admin1', crypt('pass123', gen_salt('bf', 10)), 'admin')
ON CONFLICT (username) DO UPDATE
SET role = EXCLUDED.role;
