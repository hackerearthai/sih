-- ============================================================
-- SIH26190 — Secure Document Management System
-- Database schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid() fallback

-- Users table (demo / hardcoded users seeded by seed.js)
CREATE TABLE IF NOT EXISTS users (
  "userId"       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       VARCHAR(100) UNIQUE NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  role           VARCHAR(20)  NOT NULL
                 CHECK (role IN ('investigator', 'court_clerk', 'admin'))
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  "docId"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename         VARCHAR(255) NOT NULL,
  filepath         TEXT         NOT NULL,
  "docHash"        VARCHAR(64)  NOT NULL,
  "uploaderId"     UUID         NOT NULL REFERENCES users("userId"),
  timestamp        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "aiRiskFlag"     VARCHAR(30)  DEFAULT 'pending',
  "currentVersion" INT          DEFAULT 1
);

-- Document versions (append-only history)
CREATE TABLE IF NOT EXISTS document_versions (
  id            SERIAL       PRIMARY KEY,
  "docId"       UUID         NOT NULL REFERENCES documents("docId"),
  version       INT          NOT NULL,
  filepath      TEXT         NOT NULL,
  "docHash"     VARCHAR(64)  NOT NULL,
  reason        TEXT,
  "updatedBy"   UUID,
  timestamp     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
