CREATE TYPE ticket_status AS ENUM (
    'draft',
    'new',
    'in_progress',
    'resolved',
    'closed'
);

CREATE TYPE closure_type AS ENUM ('normal', 'rejected', 'forced');

CREATE TYPE author_role AS ENUM ('employee', 'admin');

CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    escalation_minutes INT NOT NULL DEFAULT 15,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    min_client_version TEXT NOT NULL DEFAULT '0.1.0',
    retention_days INT NOT NULL DEFAULT 45,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (id) VALUES (1);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    allows_priority BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE category_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_number BIGSERIAL UNIQUE,
    row_label TEXT NOT NULL,
    desk_label TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id),
    description TEXT NOT NULL DEFAULT '',
    status ticket_status NOT NULL DEFAULT 'draft',
    closure_type closure_type,
    closure_reason TEXT,
    assigned_admin_id UUID REFERENCES admins(id),
    is_priority BOOLEAN NOT NULL DEFAULT FALSE,
    is_escalated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_submitted ON tickets(submitted_at DESC);
CREATE INDEX idx_tickets_public_number ON tickets(public_number);

CREATE TABLE ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_role author_role NOT NULL,
    author_admin_id UUID REFERENCES admins(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_ticket ON attachments(ticket_id);
