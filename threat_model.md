# Threat Model

## Project Overview

This project is a white-label bot detection platform with a React frontend, an Express/TypeScript backend, PostgreSQL storage, and a bundled PHP integration package that customers can deploy on their own sites. Production-facing surfaces are the admin dashboard under `/interface`, the client dashboard under `/user`, the public classification API at `/api/classify`, the domain marketplace endpoints, and the PHP package files that expose their own login, configuration, analytics, and redirect flow.

Production scope for this scan excludes development-only tooling, local mockups, and Vite development behavior. The deployed platform provides TLS in production, but application-layer authentication, authorization, secret handling, and data exposure controls remain in scope.

## Assets

- **Admin accounts and sessions** — admin access can change API keys, detection rules, redirect targets, user records, IP allowlists, and domain-pool settings.
- **Client-user accounts and sessions** — client users can access traffic logs, redirect destinations, API-key-linked configuration, and generated tracking domains.
- **API keys and service secrets** — classification API keys, the IP2Location/CleanTraffic key, session secrets, and PHP package secrets enable visitor classification and administrative control.
- **Visitor analytics data** — IP addresses, coarse location, user agents, device type, classification outcome, and timestamps are sensitive operational data.
- **Redirect configuration** — human and bot redirect URLs control where protected traffic is sent and can be abused for traffic theft or malicious redirection if modified by an attacker.
- **Domain pool inventory** — available tracking domains and generation history are business-sensitive and can be abused if exposed or if generation controls fail.

## Trust Boundaries

- **Browser or PHP package to Express API** — all client traffic is untrusted and must be authenticated, authorized, validated, and rate-limited as needed.
- **Express API to PostgreSQL** — the server has broad access to persistent secrets, accounts, and analytics data; authorization mistakes or injection here expose the full dataset.
- **Express API to external IP intelligence service** — server-side fetches use a privileged API key and should not be redirectable or attacker-controlled beyond intended parameters.
- **Client user to admin boundary** — admin-only routes must stay separate from client-user routes even when both use cookie-backed sessions.
- **Public internet to PHP package admin/config files** — the bundled PHP package runs outside the main Node app and must independently enforce authentication and protect stored configuration files.
- **Public to authenticated dashboard boundary** — analytics, settings, visitor data, and domain-management actions must never be reachable without a valid authenticated session.

## Threat Categories

### Spoofing

The application relies on cookie-backed sessions for admin and client access, plus API keys for classification traffic. Protected routes must require the correct session state server-side, login flows must compare passwords against stored hashes, and session secrets must be strong and deployment-specific. The PHP package must not rely on shared default credentials for first-time admin access.

### Tampering

Authenticated attackers and untrusted clients can submit redirect URLs, domain names, API keys, and classification inputs. The system must validate and constrain these values so users cannot modify other users' configuration, force server-side requests to unintended targets, or poison analytics/configuration files.

### Information Disclosure

The system stores visitor IPs, user agents, coarse geolocation, account data, and operational secrets. API responses, PHP endpoints, logs, and downloadable artifacts must not expose secrets or analytics data to unauthenticated users. Client users should only see data tied to their own API key, and admin-only data must remain private.

### Denial of Service

Public classification traffic and server-side external calls are attacker-reachable. The system should avoid attacker-controlled requests that can tie up outbound connections or expensive lookups, and login or public endpoints should not permit trivial abuse that exhausts resources or locks operators out.

### Elevation of Privilege

Admin endpoints, client-user endpoints, and PHP-package admin functions represent separate privilege levels. The application must prevent unauthenticated access, cross-user access, and misuse of public endpoints to gain administrative control, extract protected data, or act on behalf of another tenant.

## Scan Anchors

- `server/index.ts` — global middleware, logging, bootstrapping, security headers
- `server/routes.ts` — auth flows, session config, public API endpoints, domain routes, redirect and settings management
- `server/storage.ts` and `shared/schema.ts` — account models, secret storage, tenant scoping, analytics access
- `cleantraffic-php-package/admin_auth.php` — PHP admin authentication
- `cleantraffic-php-package/get_config.php` and `update_config.php` — PHP config access and mutation
- `cleantraffic-php-package/get_visitors.php` — PHP analytics exposure
- `cleantraffic-php-package/redirect.php` — public redirect and visitor logging path

## Out of Scope

- Vite development-only behavior and local-only mockup paths
- Hypothetical issues that require source-code modification, local shell access, or non-production tooling
- Platform-managed TLS certificate lifecycle
