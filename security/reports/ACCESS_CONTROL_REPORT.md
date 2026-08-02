# ACCESS_CONTROL Security Report

## Status: PASS

## Findings

### Architecture
This application has **no API routes**. All data access is through Supabase client SDK with RLS policies enforcing access control at the database level.

### How ownership/access works
There are no per-resource ownership checks needed because:
1. This is a **single-store** management system (not multi-tenant)
2. All data belongs to the same store
3. Access is controlled by **role** (owner vs staff), not per-resource ownership
4. RLS policies enforce role-based access at the database level

### Policy structure
- **Owner role**: Full CRUD on all tables (the store owner manages everything)
- **Staff role**: Read-only on most tables, write on sales-related tables (with `created_by = auth.uid()` constraint)
- **Sales inserts**: Staff can only insert records where `created_by = auth.uid()` — preventing impersonation

### Resource ID patterns
Routes with resource IDs:
- `/products/[id]` — Protected by RLS (owner: full access, staff: read-only)
- `/products/[id]/edit` — Protected by RLS (only owner can update)

Since there's no multi-tenancy, there's no "other user's resource" to access. All data is shared within the store.

## What's at risk

Nothing. The single-tenant design means ownership checks are replaced by role-based access, which is correctly enforced at the database level.

## What's already secure

- Staff sales orders enforced: `created_by = auth.uid()` in INSERT policies
- Staff stock movements enforced: `created_by = auth.uid()` in INSERT policies
- Staff notifications scoped: `user_id = auth.uid()` for SELECT/UPDATE
- Staff users table: Can only see their own row (`id = auth.uid()`)
- No route accepts a user_id parameter that could be manipulated to access other users' data

## Recommendations

None. Single-tenant store management with role-based access is the correct model here.
