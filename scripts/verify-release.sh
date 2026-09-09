#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "$0")/.." && pwd)"
audit_registry="https://registry.npmjs.org"

cd "$repository_root"
./scripts/check-secrets.sh

(
  cd backend
  ./mvnw test
  ./mvnw -DskipTests package
)

pnpm --dir admin-web check:api-contract
pnpm --dir admin-web test
pnpm --dir admin-web test:e2e
pnpm --dir admin-web lint
pnpm --dir admin-web build
pnpm --dir admin-web audit --prod --audit-level high --registry="$audit_registry"

pnpm --dir miniprogram check:api-contract
pnpm --dir miniprogram typecheck
pnpm --dir miniprogram lint
pnpm --dir miniprogram build:weapp
pnpm --dir miniprogram test:e2e
pnpm --dir miniprogram audit --prod --audit-level high --registry="$audit_registry"

docker build --tag changqingjing-backend:verification backend
./deploy/test-config.sh
./deploy/test-stack.sh

echo "Release verification passed."
