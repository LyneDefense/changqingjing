#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

tracked_files=()
while IFS= read -r -d '' file; do
  tracked_files+=("$file")
done < <(git ls-files -z)

if ((${#tracked_files[@]} == 0)); then
  echo "No tracked files to scan."
  exit 0
fi

patterns=(
  'AKID[A-Za-z0-9]{13,}'
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
  '(COS_SECRET_ID|COS_SECRET_KEY|WECHAT_APP_SECRET|ADMIN_BOOTSTRAP_PASSWORD)[=:][[:space:]]*[A-Za-z0-9/+_-]{8,}'
)

failed=0
for pattern in "${patterns[@]}"; do
  if git grep -nEI -- "$pattern" -- "${tracked_files[@]}"; then
    failed=1
  fi
done

if ((failed)); then
  echo "Potential secret found in tracked files." >&2
  exit 1
fi

echo "No high-confidence secrets found in tracked files."
