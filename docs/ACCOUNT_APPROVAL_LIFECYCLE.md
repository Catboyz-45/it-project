# Account approval lifecycle

Account approval applies to owner/property-admin accounts. `OWNER` is the
user-facing name; `PROPERTY_ADMIN` remains the single internal role.

```text
Super Admin creates account
          |
          v
       PENDING
        /   \
       v     v
 APPROVED   REJECTED
     |
     v
Login allowed when isActive = true
```

- `PENDING`: credentials exist, but login and existing sessions are denied.
- `APPROVED`: login is allowed while `isActive` is also `true`.
- `REJECTED`: login is denied and existing sessions are revoked.
- `isActive`: independent operational suspension after approval.
- Tenant accounts are approved at account level during invitation
  registration; their room access still requires the separate owner-managed
  occupancy approval.
- Existing accounts are migrated to `APPROVED` to avoid an accidental lockout.

Only a Super Admin can call
`PATCH /api/v1/super-admin/users/{userId}/approval`. Approval decisions are
recorded in the audit log and cannot be repeated once the account leaves
`PENDING`.
