ALTER TABLE user_phone
    ADD CONSTRAINT user_phone_query_digest_uk UNIQUE (phone_query_digest);
