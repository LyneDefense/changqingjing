-- Run only against the isolated restored database, never the live database.
BEGIN;
CREATE TEMP TABLE imported_admin (LIKE public.admin_account);
COPY imported_admin FROM STDIN WITH (FORMAT csv);
