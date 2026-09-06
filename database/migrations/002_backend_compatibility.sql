-- The existing API uses camelCase identifiers. These simple, writable views
-- map that contract onto the canonical tables without duplicating any records.
-- Only the API connection uses this search path; migrations use public.
CREATE SCHEMA IF NOT EXISTS backend_api;

CREATE OR REPLACE VIEW backend_api.users AS
SELECT user_id AS "userId", username, password_hash AS "passwordHash", role
FROM public.users;

CREATE OR REPLACE VIEW backend_api.documents AS
SELECT doc_id AS "docId", filename, filepath, doc_hash AS "docHash",
       uploader_id AS "uploaderId", created_at AS timestamp,
       ai_risk_flag AS "aiRiskFlag", current_version AS "currentVersion"
FROM public.documents;

CREATE OR REPLACE VIEW backend_api.document_versions AS
SELECT version_id AS id, doc_id AS "docId", version_number AS version,
       filepath, doc_hash AS "docHash", reason, updated_by AS "updatedBy",
       created_at AS timestamp
FROM public.document_versions;
