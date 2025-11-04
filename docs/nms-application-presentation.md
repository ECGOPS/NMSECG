---
title: ECG NMS — Application Overview & Usage
author: Engineering
date: 2025-10-03
---

## Slide 1 — Title

ECG Network Management System (NMS)

- Modern web app for fault, inspection, and load monitoring workflows
- Secure Azure AD auth, Cosmos DB storage, real-time updates, offline-first

## Slide 2 — Audience & Goals

- For: System admins, managers, engineers, technicians
- Goals: Track faults, inspections, load data; collaborate in real time; work offline; ensure auditability

## Slide 3 — Key Features

- Fault Management: create, triage, track, resolve
- Asset Inspections (Substations, Overhead lines): guided checklists, photos
- Load Monitoring: visualize, edit, sync field readings
- Real-time Chat & Broadcasts via WebSocket
- Offline capture with background sync
- Role-based access control (RBAC)

## Slide 4 — Architecture (High-Level)

- Frontend: Vite + React + TypeScript, Tailwind UI
- Backend: Node.js + Express
- Auth: Azure AD (OIDC/JWT)
- Data: Azure Cosmos DB
- Realtime: WebSocket (wss)
- Hosting: Azure App Service (Linux)

## Slide 5 — Authentication Flow

1) User logs in with Azure AD
2) Frontend acquires JWT with scope `api://<client-id>/.default`
3) API validates JWT (issuer: `login.microsoftonline.com/<tenant>/v2.0`)
4) Backend loads user profile/role from Cosmos DB
5) Access granted based on role permissions

## Slide 6 — Roles & Permissions

- system_admin: full access; approvals; user management
- regional_manager: view/edit in assigned region(s)
- district_manager: view/edit in assigned district(s)
- district_engineer / technician: operational tasks within scope
- pending: limited read-only until approved

## Slide 7 — Real-time Collaboration

- WebSocket endpoint: `wss://<backend-host>`
- Features: chat, broadcast messages, live updates
- Automatic reconnect and connection health tracking

## Slide 8 — Offline-first Workflows

- Local persistence for forms, photos, edits
- Sync queue: creates/updates/deletes
- Online detection; conflict-aware sync
- UI shows pending counts and sync status

## Slide 9 — Fault Management Flow

1) Create/receive fault
2) Assign to team (region/district)
3) Update status and notes
4) Resolve and archive with audit trail

## Slide 10 — Substation Inspection Flow

1) Start checklist; capture GPS and photos
2) Fill sections: equipment, safety, conditions
3) Save offline if needed; sync when online
4) Submit; managers review and report

## Slide 11 — Overhead Line Inspection Flow

1) Select line segment
2) Record findings with media
3) Save offline; sync later
4) Track remediation tasks

## Slide 12 — Load Monitoring Flow

1) Retrieve assets and pending readings
2) Enter/edit readings; validate ranges
3) Save offline; background sync
4) Managers review trends and anomalies

## Slide 13 — Setup (Local Dev)

- Frontend `.env`:
  - `VITE_API_BASE_URL=https://<backend-host>`
  - Azure AD vars: client ID, tenant ID, redirect URIs, scope
- Start: `npm run dev`

## Slide 14 — Backend (Azure)

- Required env (production):
  - `AZURE_AD_AUDIENCE`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`
  - `COSMOS_DB_ENDPOINT`, `COSMOS_DB_KEY`, `COSMOS_DB_DATABASE`
- Health: `GET /api/health`

## Slide 15 — WebSocket Config

- File: `src/config/websocket.ts`
- Production URL: `wss://<backend-host>`
- Ensure `FORCE_PRODUCTION` aligned with deployment needs

## Slide 16 — Permissions Model

- Central `PermissionService` maps roles → features
- Fallbacks for `pending` role; approvals elevate access
- Audit-friendly changes

## Slide 17 — Security Highlights

- JWT validation (RS256), issuer and audience checks
- CORS scoped to frontend origin
- Principle of least privilege in role checks

## Slide 18 — Demo Script (5–7 min)

1) Login with Azure AD
2) Show dashboard stats and filters
3) Create a fault; broadcast a message
4) Perform a quick inspection (save offline; toggle network; sync)
5) Enter load data; show real-time chat update

## Slide 19 — Troubleshooting

- API JSON errors → check `VITE_API_BASE_URL`
- 401s → verify JWT, Azure AD config
- WebSocket not connecting → `websocket.ts` URL
- Offline items stuck → confirm online status and sync logs

## Slide 20 — Contact & Next Steps

- Admins: manage users/roles, audit logs
- Roadmap: enhanced analytics, mobile packaging, bulk ops


