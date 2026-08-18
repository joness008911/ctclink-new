# Bot Detection System

## Overview

A white-label, anonymous full-stack web application for real-time bot vs. human visitor detection and classification. It provides administrators with a dashboard for monitoring statistics, managing detection rules, and viewing classification results. The system delivers reliable website visitor data with complete brand removal and privacy-focused data retention.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is a React and TypeScript application built with Vite, utilizing a component-based architecture with `shadcn/ui` (Radix UI, Tailwind CSS). State management uses TanStack Query for server state and caching, Wouter for routing, and React Hook Form with Zod for form validation. It features a dashboard with real-time statistics, detection rule management, and a robust session-based authentication system with protected routes.

### Backend Architecture

The backend is an Express.js application in TypeScript, providing a RESTful API. It handles authentication, visitor classification, statistics, and detection rules. Session management is implemented via Express session middleware. The request pipeline includes middleware for logging, JSON parsing, and error handling.

### Data Storage Solutions

The system primarily uses PostgreSQL (Neon serverless with connection pooling) via Drizzle ORM for type-safe database operations. An abstracted storage layer supports both in-memory (development) and PostgreSQL (production). The schema includes `users`, `classifications`, `detection_rules`, and `settings` for permanent configurations like API keys.

### Authentication and Authorization

The system employs session-based authentication with Express sessions. Passwords are secured using bcrypt (10 salt rounds, min 8 characters). The authentication flow involves credential validation, server-side session creation, and middleware for API route protection. The frontend manages authentication state with React Query. Separate flows exist for admin and client users, with client users requiring username/password and API key verification. Security includes HTTP-only session cookies and timing-safe password comparisons.

### System Design Choices

The system utilizes a cascading bot detection system: Country Whitelist, ISP Blacklist, Proxy Detection, and ISP Whitelist, prioritizing early blocking of known bots. It features real-time monitoring via frontend polling, with 10-minute silent logging to reduce log spam from repeat visitors. PHP integration scripts use random ZIP filenames for security, two-pass POST architecture for accurate browser/device detection, 10-minute session caching for API calls, and client-side hash parameter conversion. Browser visits to API domains are redirected for security and privacy. Security measures include Helmet middleware for server-side security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy), blocking known scrapers/preview bots (redirects them to google.com), SEO prevention (noindex/nofollow, robots.txt), client-side protection (disabled right-click, dev tools, view source, text selection), cache control, and universal path hiding (all unknown browser navigations redirect to google.com). Unknown IPs default to 'Bot' and any API classification failure also defaults to 'Bot' following a fail-secure principle.

### White-Label & Privacy Features

The system is completely white-labeled with no product name or branding visible to users:
- No product names in UI (admin dashboard, user dashboard, login pages)
- Generic page titles and empty meta descriptions
- robots.txt blocks all search engines
- localStorage keys use generic "app_remember_me" instead of branded keys
- All taglines and marketing text removed
- Maintains full functionality without any visible branding
- **Universal redirect to google.com**: All unknown paths (/, /api, /random, etc.) redirect to google.com for privacy. Only /interface (admin), /user (client), and /api/classify (API endpoint) are accessible

## Recent Changes

### December 10, 2025 (Latest)

- **🌐 DOMAIN POOL MARKETPLACE**: Implemented domain pool marketplace for admin and client users
  - **Admin Features** (Domain Pool tab in /interface):
    - Add domains individually with description and enabled status
    - Bulk upload domains (up to 100 at once via textarea)
    - Configure daily generation limit per user (default: 2)
    - Enable/disable individual domains
    - Delete domains from pool
  - **Client User Features** (Domains tab in /user):
    - Browse all enabled domains from pool
    - Test domain reachability via server-side HEAD request
    - Generate tracking links with user's API key embedded
    - Daily limit prevents excessive generation (displays remaining count)
    - Duplicate prevention: can't generate same domain twice
  - **Database**: New `domain_pool` and `user_domain_generations` tables
  - **API Endpoints**:
    - Admin: GET/POST/DELETE/PATCH at `/api/domain-pool`
    - Client: GET `/api/user/domains/available`, POST `/api/user/domains/test`, POST `/api/user/domains/generate`
  - **Fixes Applied**:
    - Changed from useQueryClient hook to shared queryClient import for proper cache invalidation
    - Server-side domain reachability testing (avoids CORS issues)
    - Server-side duplicate generation prevention (409 responses)
    - Generate button shows loading state during generation

### November 17, 2025

- **🐛 IP WHITELIST BUG FIX**: Fixed critical bug where IP whitelist was failing-open
  - **Root Cause**: Incorrect ESM import (`import * as ipaddr` instead of `import ipaddr`) caused middleware to crash
  - **Impact**: When whitelist was enabled, middleware crashed and allowed ALL IPs to access /user (opposite of intended behavior)
  - **Fix**: Corrected import to `import ipaddr from "ipaddr.js"` - now properly blocks non-whitelisted IPs
  - **Verified Behavior**: 
    - Whitelist OFF → Allow all ✅
    - Whitelist ON + empty → Block all ✅
    - Whitelist ON + entries → Allow only whitelisted IPs ✅

### November 13, 2025

- **🔒 IP WHITELIST FOR CLIENT DASHBOARD ACCESS**: Implemented IP-based access control for /user routes
  - **Feature**: Admin can whitelist specific IPs or CIDR ranges allowed to access client dashboard (/user)
  - **Security**: /interface (admin panel) always accessible - never locked out during emergencies
  - **Implementation**: 
    - Pre-session middleware checks IP before /user routes (redirects to google.com if not whitelisted)
    - 60-second in-memory cache with automatic invalidation on whitelist changes
    - ipaddr.js for robust CIDR range matching (IPv4/IPv6 support)
    - Rate-limited denial logging (max once per minute per IP)
  - **Admin UI**: New "🔒 IP Whitelist" tab in admin dashboard
    - Enable/disable toggle (disabled = allow all)
    - Add entries with label + CIDR/IP (e.g., "192.168.1.100" or "10.0.0.0/24")
    - Delete entries, toggle individual entry status
    - Warning alerts when enabled with empty list (blocks all /user access)
  - **Fail-Safe Behavior**:
    - Disabled + empty list → Allow all
    - Enabled + empty list → Redirect to google.com (with warning in UI)
    - Enabled + IP matches → Show login page
    - Enabled + IP no match → Redirect to google.com
    - Error during check → Fail-open (allow to prevent lockout)
  - **Database**: New `client_ip_whitelist` table with label, cidr, enabled fields
  - **API Routes**: Full CRUD at `/api/client-ip-whitelist` (GET, POST, DELETE, PATCH for toggle, PUT for enable/disable)

- **🔇 10-MINUTE SILENT LOGGING**: Implemented intelligent rate limiting for classification logs
  - **Feature**: First visit from an IP address is logged normally, subsequent visits from the same IP within 10 minutes are processed silently (not logged), then logging resumes after 10 minutes
  - **Purpose**: Reduces log spam from repeat visitors while maintaining accurate classification responses
  - **Implementation**: In-memory tracking map (`ipLastLogTime`) with hourly cleanup to prevent memory leaks
  - **Behavior**: 
    - First visit from IP X at 1:00 PM → Logged to database ✅
    - Same IP visits at 1:05 PM → Silent (not logged) 🔇
    - Same IP visits at 1:11 PM → Logged to database ✅ (10+ minutes elapsed)
  - **Benefits**: Cleaner logs, reduced database writes, maintained classification accuracy
  - **Console Logging**: Shows "📝 Logged classification" or "🔇 Silent mode" with time remaining until next log

### November 11, 2025
- **✅ COMPLETE WHITE-LABEL IMPLEMENTATION**: Removed all product branding and names
  - **HTML Changes**: Updated page title to "Dashboard" with empty meta description
  - **UI Changes**: Removed all product names, taglines, and marketing text from login pages, dashboards, sidebar
  - **localStorage Keys**: Changed from branded keys to generic "app_remember_me"
  - **SEO Prevention**: Created public/robots.txt to block all search engines ("User-agent: *, Disallow: /")
  - **Privacy Focus**: Legal notices updated to use generic "this service" instead of product names
  - **Zero Branding**: Users see only form fields and navigation, no product identity
  - **ISP Blacklist Bulk Upload**: Added bulk upload feature (up to 1000 ISPs)
    - Frontend: Textarea for pasting multiple ISP names, category selection
    - Backend: Deduplication, validation, error handling, detailed feedback
    - Returns: {added, skipped, errors[]} with actionable error messages

### November 10, 2025
- **🔧 PHP SCRIPT PRODUCTION FIX + CACHE INVALIDATION**: Resolved caching and bot detection issues
  - **Problem 1 - Headers Already Sent**: White pages and header errors on cPanel/aaPanel production servers
    - **Root Cause**: Mixed server/client logic causing premature HTML output before headers
    - **Solution**: Two-pass POST architecture - JavaScript collects browser/device data, submits form, then PHP redirects
  - **Problem 2 - Stale Cached URLs**: Changing redirect URLs in dashboard didn't take effect immediately (10-minute cache held old URLs)
    - **Root Cause**: PHP session cache stored redirect URLs without version tracking
    - **Solution**: Cache versioning system - API returns `redirectVersion` timestamp, PHP compares versions and invalidates stale caches
    - **Result**: URL changes take effect on next visitor (instant invalidation when versions mismatch)
  - **Problem 3 - Missing Bot Detection**: Local bot pattern matching was removed
    - **Root Cause**: Bot detection function defined but never invoked
    - **Solution**: Known bots (curl, wget, Googlebot, etc.) now short-circuit API calls after first visit
    - **Performance**: Saves API calls for obvious bots while maintaining accurate redirect URLs
  - **Technical Implementation**:
    - API returns `redirectVersion` (milliseconds timestamp) from `userRedirectUrls.updatedAt`
    - PHP stores version with cached redirects, compares on next visit
    - Known bots use dual-invalidation cache: version mismatch OR 60-second TTL expiry
    - Global `ct_latest_version` tracks highest version seen across all visitors
    - Bot cache (`ct_bot_url`, `ct_bot_version`, `ct_bot_checked_at`) refreshes when:
      - Any visitor receives higher `redirectVersion` from API (immediate), OR
      - 60 seconds elapse since last bot classification (TTL fallback)
    - Two-pass architecture: Pass 1 = JavaScript collection, Pass 2 = classification & redirect
  - **Architect Verified**: ✅ Cache versioning sound, bot detection active, production-ready
  - **Working Email Separators**: `?e=email` (query) and `#e=email` (hash)

## External Dependencies

- **Database**: Neon Database (PostgreSQL-compatible serverless)
- **UI/Styling**: Radix UI, Tailwind CSS, Lucide React
- **Development**: Vite, TypeScript, ESBuild
- **Utilities**: `date-fns`, `clsx`, `class-variance-authority`, `UA-Parser-js`, `Zod`
- **Session Store**: `connect-pg-simple` (for PostgreSQL session storage)