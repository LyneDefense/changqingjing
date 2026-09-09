CREATE TABLE map_selection (
    id uuid PRIMARY KEY,
    actor_id uuid NOT NULL REFERENCES admin_account (id) ON DELETE CASCADE,
    provider_name varchar(255) NOT NULL,
    provider_address varchar(1000) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    latitude numeric(9,7) NOT NULL,
    coordinate_system varchar(20) NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT map_selection_name_ck CHECK (length(trim(provider_name)) > 0),
    CONSTRAINT map_selection_address_ck CHECK (length(trim(provider_address)) > 0),
    CONSTRAINT map_selection_longitude_ck CHECK (longitude BETWEEN 72 AND 138),
    CONSTRAINT map_selection_latitude_ck CHECK (latitude BETWEEN 0.8 AND 56),
    CONSTRAINT map_selection_coordinate_system_ck CHECK (coordinate_system = 'GCJ02')
);

CREATE INDEX map_selection_actor_expires_idx ON map_selection (actor_id, expires_at);
