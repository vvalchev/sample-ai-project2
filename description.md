# Real-Time Multi-Tenant Event Feed Problem
Build a real-time event broadcasting system where multiple tenants can send and receive their own events in real-time, with strict tenant isolation.

## What to Build
### Backend Service (Node.js/Express):
- WebSocket server that handles connections with tenant authentication
- Simple in-memory event storage per tenant
- REST endpoint to post events: POST /events (with tenant header)
- WebSocket broadcasts events only to same-tenant connections

### Frontend (Simple HTML/JS):
- Basic page with tenant login (dropdown: "Tenant A" or "Tenant B")
- Real-time event list that updates via WebSocket
- Form to send new events
- Clear visual indication when events arrive
- Use Vanilla JS, no web frameworks like react/angular/vue ..etc.

### Data Model:
```json
{
"id": "uuid",
"tenant_id": "tenant_a",
"message": "User logged in", "timestamp": "2025-01-20T10:30:00Z"
}
```

## Requirements
- Tenant Isolation: Tenant A never sees Tenant B's events
- Real-time: Events appear in UI within 1 second
- Simple Auth: Use tenant ID in header/query param (no complex JWT)
- In-Memory Only: No database required

## Success Criteria
- Two browser windows (different tenants) show different event streams
- Posting event from one tenant appears only in that tenant's windows
- Clean, documented code with setup instructions
