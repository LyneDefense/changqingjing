# Project environment and delivery rules

## Repository layout

- Keep the WeChat mini program, Spring Boot backend, and admin web frontend as independent projects under `miniprogram/`, `backend/`, and `admin-web/`.
- The backend contains both mini program APIs and admin APIs. Keep their routes, authentication, and authorization separate.
- Product and technical documentation lives in `docs/`.

## Confirmed technology

- Mini program: Taro + React + TypeScript.
- Backend: JDK 18, Spring Boot 3.2.12, Spring Security, MyBatis-Plus, PostgreSQL.
- Admin web: React + TypeScript + Vite unless the user changes this decision.
- Media storage: Tencent Cloud COS. Do not store uploaded images or videos in PostgreSQL or on container-local disk.
- Deployment: Docker Compose and Nginx on the remote server.

## Environments

- Local development machine: macOS.
- Remote production server: Tencent Cloud Ubuntu.
- Keep local, test, and production configuration separate. Never commit production secrets.

## Domain, TLS, and deployment

- The project has one business domain. Use path routing on the same HTTPS host: `/admin/`, `/api/v1/admin/`, and `/api/v1/app/`.
- When the user later supplies the domain and server details, configure Nginx for that exact domain and configure the WeChat legal domains accordingly.
- TLS certificates must renew automatically. Use Certbot with an ACME webroot and a host systemd timer that renews the certificate and reloads the Nginx container after a successful renewal.
- Provide and maintain a single deployment entry point at `deploy/deploy.sh`. It must support first-time TLS bootstrap, database migration, Docker Compose rollout, health checks, and ordinary repeat deployments without manual container commands.
- Do not guess production domain names, COS bucket names, regions, credentials, SSH targets, or certificate email addresses. Obtain them from the user at deployment time and place them in an uncommitted production environment file.

## Version note

- JDK 18 is a user-selected constraint and is not an LTS Java release. Keep the backend build and runtime on the same Java major version. Record an upgrade to an actively supported LTS JDK as a production maintenance recommendation, but do not silently change the configured JDK.

## Task and commit discipline

- Keep each coding task short and focused on one feature or one coherent infrastructure change.
- Finish and verify the current feature before starting the next feature.
- Commit each completed feature immediately without asking the user for approval.
- Use a concise, natural commit message that describes the change. Avoid AI-style wording, generated-by notices, long summaries, and conversational text in commit messages.
- Do not mix unrelated refactors, formatting, documentation, or features into the same commit.
