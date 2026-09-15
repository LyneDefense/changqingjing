"""Prepare a consistent local backup and verified COS copies; never changes production DB."""
import argparse
import base64
import csv
from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parent.parent


def run(command, data=None, output=None, env=None):
    result = subprocess.run(command, input=data, stdout=output or subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    if result.returncode:
        # pg_restore/COPY/SDK errors may contain business data; do not echo them.
        raise RuntimeError(f"Command failed: {Path(command[0]).name}; exit {result.returncode}")
    return result.stdout


def local_psql(container, database, sql):
    return run(["docker", "exec", "-i", container, "sh", "-c",
                'exec psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"', "sh", database], sql.encode())


def copy_media(records, settings, prefix, import_id):
    from qcloud_cos import CosConfig, CosS3Client
    from qcloud_cos.cos_exception import CosServiceError
    logging.disable(logging.CRITICAL)
    client = CosS3Client(CosConfig(Region=settings["COS_REGION"], SecretId=settings["COS_SECRET_ID"],
                                 SecretKey=settings["COS_SECRET_KEY"], Scheme="https", Timeout=30))
    bucket = settings["COS_BUCKET"]
    verified = []
    # Preflight every source before creating any copies.
    for asset in records:
        assert asset["status"] == "READY", "Only READY media can be migrated by this workflow"
        source = client.head_object(Bucket=bucket, Key=asset["object_key"])
        assert int(source["Content-Length"]) == asset["size_bytes"], "Source COS size mismatch"
        assert source["ETag"].strip('"') == asset["etag"].strip('"'), "Source COS ETag mismatch"
        key = f"{prefix}/imports/{import_id}/{asset['id']}{Path(asset['object_key']).suffix}"
        try:
            client.head_object(Bucket=bucket, Key=key)
        except CosServiceError as error:
            if error.get_status_code() != 404:
                raise RuntimeError("Cannot verify that target COS object is absent") from None
        else:
            raise RuntimeError("Refusing to overwrite an existing COS object")
        verified.append((asset, source, key))
    mapping = []
    for index, (asset, source, key) in enumerate(verified, 1):
        client.copy_object(Bucket=bucket, Key=key,
                           CopySource={"Bucket": bucket, "Region": settings["COS_REGION"], "Key": asset["object_key"]},
                           CopySourceIfMatch=source["ETag"])
        target = client.head_object(Bucket=bucket, Key=key)
        assert target["Content-Length"] == source["Content-Length"], "Copied COS size mismatch"
        assert target.get("Content-Type") == source.get("Content-Type"), "Copied COS content-type mismatch"
        checksum = "x-cos-hash-crc64ecma"
        assert source.get(checksum) and source[checksum] == target.get(checksum), "Copied COS CRC64 mismatch"
        mapping.append([asset["id"], asset["object_key"], key, source["ETag"].strip('"'),
                        target["ETag"].strip('"'), asset["size_bytes"]])
        print(f"Verified production COS copy {index}/{len(records)}", flush=True)
    return mapping


def main():
    if sys.flags.optimize:
        raise RuntimeError('Import safety checks require Python optimization to be disabled')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ssh-target", required=True)
    parser.add_argument("--remote-repository", required=True)
    args = parser.parse_args()
    assert not args.ssh_target.startswith("-") and re.fullmatch(r"[A-Za-z0-9_.@-]+", args.ssh_target), "Invalid SSH target"
    assert args.remote_repository.startswith("/") and re.fullmatch(r"[A-Za-z0-9_./-]+", args.remote_repository), "Invalid remote path"
    os.umask(0o077)
    environment = run(["bash", "-c", 'set -a; source "$1"; set +a; env -0', "bash", str(ROOT / ".env.local")])
    settings = dict(item.decode().split("=", 1) for item in environment.split(b"\0") if b"=" in item)
    compose = ["docker", "compose", "--project-directory", str(ROOT), "--env-file", str(ROOT / ".env.local"),
               "--file", str(ROOT / "compose.local.yaml")]
    container = run(compose + ["ps", "-q", "postgres"], env=settings).decode().strip()
    assert re.fullmatch(r"[a-f0-9]{12,64}", container), "Local project PostgreSQL is not running"
    server_environment = json.loads(run(["ssh", "-o", "ConnectTimeout=10", args.ssh_target,
        f"cd {shlex.quote(args.remote_repository)} && sudo -n docker inspect changqingjing-backend-1 --format '{{{{json .Config.Env}}}}'"]))
    target = dict(value.split("=", 1) for value in server_environment)
    for key in ("APP_PHONE_ENCRYPTION_KEY_BASE64", "WECHAT_APP_ID", "COS_BUCKET", "COS_REGION"):
        assert settings[key] == target[key], f"Local/server configuration mismatch: {key}"
    prefix = target["COS_OBJECT_PREFIX"].strip("/")
    assert re.fullmatch(r"[A-Za-z0-9_/-]+", prefix) and prefix.split("/")[0] not in ("dev", "local"), "Invalid production prefix"
    import_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    bundle = ROOT / "deploy" / "data" / ("local-import-" + import_id)
    bundle.mkdir(parents=True, mode=0o700)
    verification_database = "cqj_prepare_" + uuid.uuid4().hex
    with (bundle / "source.dump").open("wb") as archive:
        run(["docker", "exec", container, "sh", "-c",
             'exec pg_dump --format custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], output=archive)
    run(["docker", "exec", container, "sh", "-c", 'exec createdb -U "$POSTGRES_USER" "$1"', "sh", verification_database])
    try:
        run(["docker", "exec", "-i", container, "sh", "-c",
             'exec pg_restore --single-transaction --no-owner --no-acl -U "$POSTGRES_USER" -d "$1"', "sh", verification_database],
            (bundle / "source.dump").read_bytes())
        snapshot = json.loads(local_psql(container, verification_database, (ROOT / "deploy/sql/data-import-snapshot.sql").read_text()))
        assert snapshot["tables"]["admin_account"]["rows"] == 1, "Multiple local admins require a separately reviewed merge"
        phone_records = json.loads(local_psql(container, verification_database,
            "SELECT coalesce(json_agg(json_build_object('cipher', encode(phone_ciphertext,'base64'), 'digest',encode(phone_query_digest,'hex'), 'version',encryption_key_version)), '[]'::json) FROM user_phone;"))
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        encryption_key = base64.b64decode(settings["APP_PHONE_ENCRYPTION_KEY_BASE64"], validate=True)
        for phone in phone_records:
            assert phone["version"] == 1, "Unsupported phone encryption version"
            protected = base64.b64decode(phone["cipher"])
            plaintext = AESGCM(encryption_key).decrypt(protected[:12], protected[12:], None)
            assert hmac.compare_digest(hmac.new(encryption_key, b"changqingjing:user-phone:v1:" + plaintext, hashlib.sha256).hexdigest(), phone["digest"]), "Phone digest/key verification failed"
        print(f"Local backup restored and verified; {len(phone_records)} encrypted phone record(s) verified.", flush=True)
        records = json.loads(local_psql(container, verification_database,
            "SELECT coalesce(json_agg(json_build_object('id',id,'object_key',object_key,'size_bytes',size_bytes,'etag',etag,'status',status) ORDER BY id), '[]'::json) FROM media_asset;"))
        mapping = copy_media(records, settings, prefix, import_id)
        with (bundle / "media.csv").open("w", newline="") as destination:
            csv.writer(destination, lineterminator="\n").writerows(mapping)
        manifest = {"format_version": 1, "snapshot": snapshot,
                    "dump_sha256": hashlib.sha256((bundle / "source.dump").read_bytes()).hexdigest(),
                    "media_sha256": hashlib.sha256((bundle / "media.csv").read_bytes()).hexdigest(),
                    "settings": {key: hashlib.sha256(target[key].encode()).hexdigest() for key in
                        ("APP_PHONE_ENCRYPTION_KEY_BASE64", "WECHAT_APP_ID", "COS_BUCKET", "COS_REGION", "COS_OBJECT_PREFIX")}}
        (bundle / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"Import bundle ready: {bundle}", flush=True)
    finally:
        run(["docker", "exec", container, "sh", "-c", 'exec dropdb -U "$POSTGRES_USER" "$1"', "sh", verification_database])


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Preparation stopped; production database was not changed: {error if isinstance(error, (AssertionError, RuntimeError)) else type(error).__name__}", file=sys.stderr)
        sys.exit(1)
