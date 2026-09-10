ALTER TABLE content_entry DROP CONSTRAINT content_entry_kind_ck;

ALTER TABLE content_entry
    ADD CONSTRAINT content_entry_kind_ck
    CHECK (kind IN (
        'HOME_HERO', 'HOME_VIDEO', 'COMPANY', 'SCENIC',
        'PRODUCT', 'PRODUCT_CATEGORY', 'COOPERATION'
    ));
