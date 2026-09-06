-- SIH26190 database schema.
-- Blockchain hashes and history remain authoritative; this database is the
-- application store and a fast cache for access-log reads.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL
    CONSTRAINT users_role_check
    CHECK (role IN ('investigator', 'court_clerk', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  doc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  doc_hash TEXT NOT NULL,
  uploader_id UUID NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  ai_risk_flag TEXT
    CONSTRAINT documents_ai_risk_flag_check
    CHECK (ai_risk_flag IN ('clean', 'review_recommended')),
  status TEXT DEFAULT 'pending'
    CONSTRAINT documents_status_check
    CHECK (status IN ('verified', 'tampered', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_uploader_id_fkey
    FOREIGN KEY (uploader_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT documents_current_version_check CHECK (current_version >= 1)
);

CREATE TABLE IF NOT EXISTS document_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  doc_hash TEXT NOT NULL,
  filepath TEXT NOT NULL,
  reason TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_versions_doc_id_fkey
    FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE RESTRICT,
  CONSTRAINT document_versions_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT document_versions_version_number_check CHECK (version_number >= 1),
  CONSTRAINT document_versions_doc_id_version_number_key
    UNIQUE (doc_id, version_number)
);

CREATE TABLE IF NOT EXISTS access_log_cache (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT
    CONSTRAINT access_log_cache_action_check
    CHECK (action IN ('view', 'download', 'share', 'verify', 'upload')),
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT access_log_cache_doc_id_fkey
    FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE RESTRICT,
  CONSTRAINT access_log_cache_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_documents_doc_hash
  ON documents(doc_hash);

CREATE INDEX IF NOT EXISTS idx_documents_uploader_id
  ON documents(uploader_id);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc_id
  ON document_versions(doc_id);

CREATE INDEX IF NOT EXISTS idx_access_log_cache_doc_id
  ON access_log_cache(doc_id);

CREATE OR REPLACE FUNCTION set_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS documents_set_updated_at ON documents;

CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_documents_updated_at();

CREATE OR REPLACE FUNCTION prevent_document_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'document_versions is append-only; % is not allowed', TG_OP
    USING ERRCODE = '55000';
END;
$function$;

DROP TRIGGER IF EXISTS document_versions_append_only ON document_versions;

CREATE TRIGGER document_versions_append_only
BEFORE UPDATE OR DELETE ON document_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_document_version_mutation();
