# WebSocket & Real-Time Protocol Documentation

The platform uses **Socket.io** over WebSockets with automatic fallback to HTTP long-polling, built-in heartbeats, room isolation, and presence indicators.

---

## 1. Connection & Handshake Authentication

- **Endpoint**: `ws://localhost:4000` / `http://localhost:4000/socket.io/`
- **Handshake Payload**:
```javascript
const socket = io('http://localhost:4000', {
  auth: {
    token: '<jwt-token>',
    userId: '<user-id>'
  },
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling']
});
```

During the connection handshake:
1. The server validates the user identity from `token` or `userId`.
2. Unauthorized sockets are rejected immediately with `Authentication required for WebSocket connection`.

---

## 2. Tenant & Board Channel Scoping

Sockets do not listen to global streams. All broadcast channels are strictly partitioned by tenant and board:

| Channel / Room Pattern | Scope | Purpose |
|---|---|---|
| `tenant:{tenantId}:board:{boardId}` | Tenant Board Room | Task mutations, reorders, card focus, live presence |
| `tenant:{tenantId}` | Tenant Branch Stream | Audit logs, new board creation alerts across branches |

---

## 3. Client-to-Server Events

### 3.1 `board:join`
Sent by the client when navigating to a Kanban board.
```javascript
socket.emit('board:join', {
  tenantId: '527fffe4-6295-46eb-8041-3d6118bfa693',
  boardId: '77c21112-9214-49ab-893d-4c3d256860d5'
});
```
**Server Security Validation**:
- Checks if the user holds an active membership for `tenantId` (or is an `ORG_ADMIN` of the parent organization).
- If unauthorized, rejects with `{ message: "Cross-tenant channel access forbidden" }`.
- If authorized, joins `tenant:{tenantId}:board:{boardId}`, registers the user in the in-memory presence map, and broadcasts `presence:update` to all collaborators in that room.

### 3.2 `board:leave`
Sent when switching boards or leaving the view.
```javascript
socket.emit('board:leave');
```

### 3.3 `presence:focus-card`
Broadcasts when a user clicks into or focuses on a task card (e.g., opens the detail modal).
```javascript
socket.emit('presence:focus-card', {
  cardId: 'a12bc44e-9821-411a-8b1e-7e9b04928d22' // null when closed
});
```
Other collaborators in the room will instantly see a glowing tag: `[Avatar] Alice editing...`.

---

## 4. Server-to-Client Events

### 4.1 `presence:update`
Emitted whenever a collaborator joins, leaves, disconnects, or changes their focused card.
```json
{
  "room": "tenant:527fffe4-6295-46eb-8041-3d6118bfa693:board:77c21112-9214-49ab-893d-4c3d256860d5",
  "users": [
    {
      "id": "c1f711cb-40c2-4022-8d96-cbf4636d1f05",
      "name": "Alex Morgan",
      "email": "alex.admin@acme.com",
      "avatarUrl": "https://images.unsplash.com/...",
      "role": "ORG_ADMIN",
      "activeCardId": "a12bc44e-9821-411a-8b1e-7e9b04928d22"
    },
    {
      "id": "e43b1239-11ba-4412-98ab-8e019b2241aa",
      "name": "Marcus Vance",
      "email": "marcus.dev@acme.com",
      "avatarUrl": "https://images.unsplash.com/...",
      "role": "MEMBER",
      "activeCardId": null
    }
  ]
}
```

### 4.2 `task:created`
Emitted to `tenant:{tenantId}:board:{boardId}` when any collaborator creates a task.
```json
{
  "id": "...",
  "columnId": "...",
  "boardId": "...",
  "tenantId": "...",
  "title": "Fractional Indexing Optimization",
  "priority": "HIGH",
  "position": 1000.0,
  "version": 1
}
```

### 4.3 `task:updated`
Emitted when a task is edited. Contains incremented `version` for OCC synchronization.
```json
{
  "id": "...",
  "title": "Updated Task Title",
  "priority": "URGENT",
  "version": 2
}
```

### 4.4 `task:moved`
Emitted when a task card is dragged to a new column or reordered within a column.
```json
{
  "id": "...",
  "columnId": "new-column-id",
  "position": 1500.0,
  "version": 3
}
```

### 4.5 `task:deleted`
```json
{
  "id": "...",
  "columnId": "...",
  "boardId": "..."
}
```

### 4.6 `activity:logged`
Emitted to `tenant:{tenantId}` and `tenant:{tenantId}:board:{boardId}` when any audit log is recorded.
```json
{
  "id": "...",
  "action": "TASK_MOVED",
  "details": "{\"fromColumnId\":\"...\",\"toColumnId\":\"...\"}",
  "user": {
    "name": "Alex Morgan",
    "avatarUrl": "https://images.unsplash.com/..."
  },
  "createdAt": "2026-11-01T22:30:00.000Z"
}
```

---

## 5. Network Recovery & Partition Resilience

1. **Automatic Heartbeat Monitoring**:
   - `pingInterval: 10000ms`, `pingTimeout: 5000ms`.
   - If a connection drop occurs, the client UI toggles the indicator from **LIVE SYNC** (emerald) to **OFFLINE** (rose).
2. **Exponential Reconnection Backoff**:
   - Up to 10 automated reconnect attempts with incremental delays.
3. **State Reconciliation on Reconnect**:
   - Once connection is restored, the client fires `board:join` and triggers a board state refresh (`onBoardSync`), fetching all intermediate mutations and OCC version changes that took place during the network drop.
