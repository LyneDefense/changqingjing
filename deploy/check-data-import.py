"""Validate an import bundle without printing credentials or business records."""
import hashlib
import json
import os
from pathlib import Path
import sys


def main():
    if sys.flags.optimize:
        raise RuntimeError('Import safety checks require Python optimization to be disabled')
    bundle = Path(sys.argv[1])
    manifest = json.loads((bundle / "manifest.json").read_text())
    source = manifest["snapshot"]
    target = json.loads(Path(sys.argv[2]).read_text())
    stage = json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv) > 3 else None
    assert manifest["format_version"] == 1, "Unsupported import format"
    with (bundle / "source.dump").open("rb") as archive:
        assert hashlib.file_digest(archive, "sha256").hexdigest() == manifest["dump_sha256"], "Archive checksum mismatch"
    assert hashlib.sha256((bundle / "media.csv").read_bytes()).hexdigest() == manifest["media_sha256"], "Media mapping checksum mismatch"
    for setting, digest in manifest["settings"].items():
        assert setting in ("APP_PHONE_ENCRYPTION_KEY_BASE64", "WECHAT_APP_ID", "COS_BUCKET", "COS_REGION", "COS_OBJECT_PREFIX")
        assert hashlib.sha256(os.environ[setting].encode()).hexdigest() == digest, f"Configuration mismatch: {setting}"
    assert set(manifest["settings"]) == {"APP_PHONE_ENCRYPTION_KEY_BASE64", "WECHAT_APP_ID", "COS_BUCKET", "COS_REGION", "COS_OBJECT_PREFIX"}, "Missing environment fingerprints"
    for key in ("migrations", "schema", "constraints"):
        assert source[key] == target[key], f"Database structure mismatch: {key}"
    assert source["tables"]["admin_account"]["rows"] == 1, "Multiple source admins require a separately reviewed merge"
    assert target["tables"]["admin_account"]["rows"] == 1, "Expected one initialized server admin"
    for table in ("content_entry", "content_revision", "content_revision_media", "media_asset", "app_user", "user_phone", "wechat_identity", "map_selection", "scenic_stats", "scenic_view_receipt", "app_session", "wechat_api_credential"):
        assert target["tables"][table]["rows"] == 0, f"Server already has data: {table}; refusing to overwrite"
    if stage is not None:
        assert source == stage, "Restored staging data does not match the source snapshot"
    print("Import archive, configuration, database structure and destination guards passed.")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, RuntimeError, KeyError, ValueError, OSError) as error:
        print(f"Import validation failed: {error if isinstance(error, AssertionError) else type(error).__name__}", file=sys.stderr)
        sys.exit(1)
