CREATE TABLE schema_marker (
    id smallint PRIMARY KEY,
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT schema_marker_singleton CHECK (id = 1)
);

INSERT INTO schema_marker (id, description)
VALUES (1, 'Initial project baseline');
