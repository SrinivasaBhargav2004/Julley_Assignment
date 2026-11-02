# REST API Documentation

Base URL: `http://localhost:4000/api` (or configured `PORT`)

---

## 1. Authentication & Security Headers

Every request to a tenant-scoped endpoint must supply authentication and tenant isolation headers:

| Header Name | Type | Description |
|---|---|---|
| `Authorization` | String | Standard JWT bearer token: `Bearer <token>` |
| `X-Tenant-ID` | String | **Required for all tenant endpoints**. Specifies active branch |
| `X-Organization-ID` | String | Optional. Validates that the tenant belongs to this enterprise |
| `X-User-ID` | String | Optional (Demo Mode). Evaluator header to simulate any seeded user |

---

## 2. Authentication & Evaluator Endpoints

### 2.1 List Seeded Users
Returns all pre-seeded users and their role memberships for testing.
- **Route**: `GET /auth/users`
- **Response**: `200 OK`
```json
{
  "users": [
    {
      "id": "c1f711cb-40c2-4022-8d96-cbf4636d1f05",
      "email": "alex.admin@acme.com",
      "name": "Alex Morgan",
      "avatarUrl": "https://images.unsplash.com/...",
      "memberships": [
        {
          "role": "ORG_ADMIN",
          "organization": { "id": "...", "name": "Acme Global Enterprises" },
          "tenant": null
        }
      ]
    }
  ]
}
```

### 2.2 Switch Active User
Issues a valid JWT token and membership context for the requested user.
- **Route**: `POST /auth/switch-user`
- **Body**:
```json
{
  "userId": "c1f711cb-40c2-4022-8d96-cbf4636d1f05"
}
```
- **Response**: `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": { "id": "...", "name": "Alex Morgan", "email": "alex.admin@acme.com" },
  "memberships": [...]
}
```

---

## 3. Organizations & Branches (Tenants)

### 3.1 List Organizations
Lists organizations accessible to the authenticated user.
- **Route**: `GET /organizations`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`

### 3.2 List Tenants (Branches) for Organization
Returns all branches under an organization that the user has permission to view.
- **Route**: `GET /organizations/:orgId/tenants`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`
```json
{
  "tenants": [
    {
      "id": "527fffe4-6295-46eb-8041-3d6118bfa693",
      "name": "HQ - San Francisco",
      "slug": "sf-hq",
      "code": "HQ-SF",
      "_count": { "boards": 1, "tasks": 5 }
    }
  ]
}
```

---

## 4. Boards (Tenant-Scoped)

### 4.1 List Boards in Tenant
- **Route**: `GET /boards`
- **Headers**: `X-Tenant-ID: <tenantId>`, `Authorization: Bearer <token>`
- **Response**: `200 OK`

### 4.2 Get Full Board (Columns + Tasks)
Returns the board with its columns and tasks strictly scoped to `X-Tenant-ID`.
- **Route**: `GET /boards/:id`
- **Headers**: `X-Tenant-ID: <tenantId>`
- **Response**: `200 OK`

### 4.3 Create Board
Requires `ORG_ADMIN` or `TENANT_ADMIN` role. Automatically initializes 4 standard workflow columns (*Backlog, In Progress, Review, Done*).
- **Route**: `POST /boards`
- **Body**:
```json
{
  "title": "Core Platform Sprint 42",
  "description": "Tenant routing, OCC locks, and audit streaming"
}
```
- **Response**: `201 Created`

---

## 5. Tasks (Tenant-Scoped & OCC-Protected)

### 5.1 Create Task
- **Route**: `POST /boards/:boardId/tasks`
- **Headers**: `X-Tenant-ID: <tenantId>`
- **Body**:
```json
{
  "columnId": "001c6928-e7a1-4790-8b73-1cc917a4a789",
  "title": "Verify Cross-Tenant Data Shielding",
  "description": "Ensure zero IDOR leaks when requesting tasks from foreign tenants.",
  "priority": "URGENT",
  "assigneeId": "c1f711cb-40c2-4022-8d96-cbf4636d1f05",
  "dueDate": "2026-11-15T00:00:00.000Z"
}
```
- **Response**: `201 Created` (Initial OCC `version: 1`)

### 5.2 Update Task (Optimistic Concurrency Control)
Validates `expectedVersion`. If the server task has been modified by another collaborator, returns `409 Conflict`.
- **Route**: `PUT /tasks/:id`
- **Headers**: `X-Tenant-ID: <tenantId>`
- **Body**:
```json
{
  "title": "Updated Task Title",
  "priority": "HIGH",
  "expectedVersion": 1,
  "force": false
}
```
- **Success Response**: `200 OK` (Increments `version` to `2`)
- **Conflict Response**: `409 Conflict`
```json
{
  "error": "ConflictDetected",
  "message": "Concurrent Edit Conflict: This task was modified by another collaborator (Current server version: 3, your version: 1).",
  "serverVersion": 3,
  "serverTask": { "id": "...", "title": "...", "version": 3 },
  "clientVersion": 1
}
```

### 5.3 Move Task (Fractional Indexing Drag-and-Drop)
Performs $O(1)$ reordering within the same column or across columns.
- **Route**: `PATCH /tasks/:id/move`
- **Headers**: `X-Tenant-ID: <tenantId>`
- **Body**:
```json
{
  "targetColumnId": "c15c2ec0-449e-4366-9eb6-0421e427282b",
  "targetPosition": 2500.5,
  "expectedVersion": 2
}
```
- **Response**: `200 OK`

### 5.4 Delete Task
- **Route**: `DELETE /tasks/:id`
- **Headers**: `X-Tenant-ID: <tenantId>`
- **Response**: `200 OK`

---

## 6. Tenant Activity Logs

### 6.1 Get Tenant Audit Logs
Returns historical audit trail of task moves, creations, updates, and deletions scoped to this tenant branch.
- **Route**: `GET /activities`
- **Headers**: `X-Tenant-ID: <tenantId>`
- **Query Params**: `limit=50`, `boardId=<optional>`
- **Response**: `200 OK`

---

## 7. Error Codes & Edge Case Handling

| HTTP Status | Error Name | Cause & Mitigation |
|---|---|---|
| `400 Bad Request` | `TenantContextRequired` | Request missed `X-Tenant-ID` header. |
| `401 Unauthorized` | `Unauthorized` | Missing or invalid authentication token. |
| `403 Forbidden` | `CrossTenantForbidden` | **Strict Shield**: User attempted to access a tenant branch without membership. |
| `403 Forbidden` | `CrossOrganizationViolation` | Tenant does not belong to the claimed organization. |
| `403 Forbidden` | `InsufficientPermissions` | Operation restricted to `ORG_ADMIN` or `TENANT_ADMIN`. |
| `404 Not Found` | `TaskNotFound` / `BoardNotFound` | Resource does not exist within the active tenant branch. |
| `409 Conflict` | `ConflictDetected` | Concurrent write conflict detected by Optimistic Concurrency Control. |
