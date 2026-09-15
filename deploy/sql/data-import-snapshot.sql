SET TIME ZONE 'UTC';
CREATE TEMP TABLE import_snapshot (name text PRIMARY KEY, rows bigint, digest text);
DO $$
DECLARE relation text;
BEGIN
  FOR relation IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
    EXECUTE format(
      'INSERT INTO import_snapshot SELECT %L, count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '''' ORDER BY md5(to_jsonb(t)::text)), '''')) FROM public.%I t',
      relation, relation);
  END LOOP;
END $$;
SELECT json_build_object(
  'migrations', (SELECT md5(string_agg(version || ':' || checksum || ':' || success, ',' ORDER BY installed_rank)) FROM flyway_schema_history),
  'schema', (SELECT md5(string_agg(to_jsonb(c)::text, ',' ORDER BY table_name, ordinal_position)) FROM (
    SELECT table_name, column_name, ordinal_position, column_default, is_nullable, data_type,
      character_maximum_length, numeric_precision, numeric_scale, datetime_precision
    FROM information_schema.columns WHERE table_schema = 'public'
  ) c),
  -- pg_dump reparses varchar-literal IN checks into per-element text casts.
  -- Canonicalize only that equivalent uppercase-varchar array form; retain all other definitions.
  'constraints', (SELECT md5(string_agg(conrelid::regclass::text || ':' || conname || ':' ||
    regexp_replace(regexp_replace(pg_get_constraintdef(oid),
      '\((''[A-Z_]+'')::character varying\)::text', '\1::character varying', 'g'),
      '\(ARRAY\[((?:''[A-Z_]+''::character varying(?:, )?)+)\]\)::text\[\]', 'ARRAY[\1]', 'g'),
    ',' ORDER BY conrelid::regclass::text, conname))
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace),
  'tables', (SELECT json_object_agg(name, json_build_object('rows', rows, 'digest', digest) ORDER BY name) FROM import_snapshot)
);
