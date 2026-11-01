# Database Schema & Entity-Relationship (ER) Architecture

## 1. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    ORGANIZATION ||--o{ TENANT : "has many (branches)"
    ORGANIZATION ||--o{ MEMBERSHIP : "scopes"
    TENANT ||--o{ MEMBERSHIP : "grants access to"
    TENANT ||--o{ BOARD : "owns"
    TENANT ||--o{ COLUMN : "scopes"
    TENANT ||--o{ TASK : "strictly isolates"
    TENANT ||--o{ ACTIVITY_LOG : "audits"

    USER ||--o{ MEMBERSHIP : "holds"
    USER ||--o{ TASK : "creates / assigned to"
    USER ||--o{ ACTIVITY_LOG : "triggers"

    BOARD ||--o{ COLUMN : "contains"
    BOARD ||--o{ TASK : "groups"
    BOARD ||--o{ ACTIVITY_LOG : "records"

    COLUMN ||--o{ TASK : "orders"

    ORGANIZATION {
        string id PK "UUID"
        string name "Enterprise Name"
        string slug UK "Unique URL slug"
        datetime createdAt
        datetime updatedAt
    }

    TENANT {
        string id PK "UUID"
        string organizationId FK "Parent Enterprise"
        string name "Branch / Subsidiary Name"
        string slug "Branch Slug"
        string code "Branch Code (e.g. HQ-SF)"
        datetime createdAt
        datetime updatedAt
    }

    USER {
        string id PK "UUID"
        string email UK "Normalized Email"
        string name "Full Name"
        string avatarUrl "Profile image"
        datetime createdAt
        datetime updatedAt
    }

    MEMBERSHIP {
        string id PK "UUID"
        string userId FK "Assigned User"
        string organizationId FK "Scoped Org"
        string tenantId FK "Scoped Tenant (Nullable for Org Admin)"
        string role "ORG_ADMIN | TENANT_ADMIN | MEMBER"
        datetime createdAt
        datetime updatedAt
    }

    BOARD {
        string id PK "UUID"
        string tenantId FK "Strict Tenant Scoping"
        string title "Board Name"
        string description "Mission / Objective"
        string createdBy FK "User ID"
        datetime createdAt
        datetime updatedAt
    }

    COLUMN {
        string id PK "UUID"
        string boardId FK "Parent Board"
        string tenantId FK "Strict Tenant Scoping"
        string title "Column Title (e.g. In Progress)"
        float position "Fractional Indexing Position"
        string color "Hex Accent"
        datetime createdAt
        datetime updatedAt
    }

    TASK {
        string id PK "UUID"
        string columnId FK "Active Column"
        string boardId FK "Parent Board"
        string tenantId FK "Strict Tenant Scoping"
        string title "Task Title"
        string description "Markdown Content"
        string priority "LOW | MEDIUM | HIGH | URGENT"
        float position "Fractional Indexing (O(1) Drag-and-Drop)"
        string assigneeId FK "Assigned User ID"
        datetime dueDate "Due Date"
        int version "OCC Counter (1, 2, 3...)"
        string createdBy FK "Creator User ID"
        datetime createdAt
        datetime updatedAt
    }

    ACTIVITY_LOG {
        string id PK "UUID"
        string tenantId FK "Strict Tenant Scoping"
        string boardId FK "Target Board (Nullable)"
        string taskId FK "Target Task (Nullable)"
        string userId FK "Acting User"
        string action "TASK_CREATED | TASK_MOVED | etc."
        string details "JSON Diff of modified fields"
        datetime createdAt
    }
```

---

## 2. Table Specifications & Indexing Strategy

### 2.1 `organizations`
Top-level enterprise entity.
- `id` (VARCHAR(36), PK): UUID
- `name` (VARCHAR(255)): Name of the enterprise
- `slug` (VARCHAR(100), UNIQUE): Unique URL identifier

### 2.2 `tenants` (Branches / Divisions)
Child entity of `organizations`. Represents individual office branches, regional subsidiaries, or isolated teams.
- `id` (VARCHAR(36), PK): UUID
- `organizationId` (VARCHAR(36), FK): Cascade on delete
- `name` (VARCHAR(255)): Branch name
- `slug` (VARCHAR(100)): Unique per organization (`@@unique([organizationId, slug])`)
- `code` (VARCHAR(20)): Human-readable code (e.g., `HQ-SF`, `LDN-RND`, `TKO-LAB`)
- **Index**: `@@index([organizationId])`

### 2.3 `users`
Global user identity. Users belong to the system and access organizations/tenants via `memberships`.
- `id` (VARCHAR(36), PK): UUID
- `email` (VARCHAR(255), UNIQUE): User email address
- `name` (VARCHAR(255)): Display name
- `avatarUrl` (VARCHAR(500), NULLABLE): Avatar photo URL

### 2.4 `memberships` (Role-Based Access Control)
Associates a `User` with an `Organization` and optionally a specific `Tenant`.
- `id` (VARCHAR(36), PK): UUID
- `userId` (VARCHAR(36), FK)
- `organizationId` (VARCHAR(36), FK)
- `tenantId` (VARCHAR(36), FK, NULLABLE):
  - When `tenantId == NULL` and `role == 'ORG_ADMIN'`, the user has org-wide privileges across **all** tenant branches in that organization.
  - When `tenantId` is set, the user's role is strictly confined to that branch.
- `role` (VARCHAR(50)): `ORG_ADMIN`, `TENANT_ADMIN`, `MEMBER`
- **Indices**:
  - `@@index([userId])`
  - `@@index([organizationId])`
  - `@@index([tenantId])`

### 2.5 `boards`
Business collection of columns and tasks, strictly owned by a `tenantId`.
- `id` (VARCHAR(36), PK): UUID
- `tenantId` (VARCHAR(36), FK): Enforces row-level isolation
- `title` (VARCHAR(255))
- `description` (TEXT, NULLABLE)
- `createdBy` (VARCHAR(36))
- **Index**: `@@index([tenantId])`

### 2.6 `columns`
Workflow steps within a board (e.g., Backlog, In Progress, Review, Completed).
- `id` (VARCHAR(36), PK): UUID
- `boardId` (VARCHAR(36), FK)
- `tenantId` (VARCHAR(36), FK): Enforces tenant verification
- `title` (VARCHAR(255))
- `position` (FLOAT): Fractional index for ordering columns
- `color` (VARCHAR(20)): Column accent color
- **Indices**:
  - `@@index([boardId, position])`
  - `@@index([tenantId])`

### 2.7 `tasks`
Individual cards containing work items.
- `id` (VARCHAR(36), PK): UUID
- `columnId` (VARCHAR(36), FK): Associated column
- `boardId` (VARCHAR(36), FK): Associated board
- `tenantId` (VARCHAR(36), FK): **Strict row-level isolation field**
- `title` (VARCHAR(255))
- `description` (TEXT, NULLABLE)
- `priority` (VARCHAR(20)): `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- `position` (FLOAT): **Fractional indexing position** allowing $O(1)$ drag-and-drop reordering without table-wide locking
- `assigneeId` (VARCHAR(36), FK, NULLABLE)
- `dueDate` (DATETIME, NULLABLE)
- `version` (INT, DEFAULT 1): **Optimistic Concurrency Control (OCC) counter**
- `createdBy` (VARCHAR(36), FK)
- **Indices**:
  - `@@index([columnId, position])` (Ultra-fast column rendering)
  - `@@index([boardId])`
  - `@@index([tenantId])` (Zero cross-tenant scan leakage)

### 2.8 `activity_logs`
Append-only audit trail recording every change within a tenant branch.
- `id` (VARCHAR(36), PK): UUID
- `tenantId` (VARCHAR(36), FK): Scoped strictly to branch
- `boardId` (VARCHAR(36), FK, NULLABLE)
- `taskId` (VARCHAR(36), FK, NULLABLE)
- `userId` (VARCHAR(36), FK)
- `action` (VARCHAR(50)): `TASK_CREATED`, `TASK_UPDATED`, `TASK_MOVED`, `TASK_DELETED`, `BOARD_CREATED`
- `details` (TEXT): JSON-serialized before/after diffs
- **Indices**:
  - `@@index([tenantId, createdAt])` (Fast reverse-chronological retrieval)
  - `@@index([boardId])`
  - `@@index([taskId])`
