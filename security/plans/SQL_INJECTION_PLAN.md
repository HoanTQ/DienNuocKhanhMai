# SQL_INJECTION Fix Plan

## Status: LOW — No critical fixes needed

## Changes

Optional refactor (code quality, not security):
- `src/components/shared/ProductSearch.tsx` — Consider using individual `.ilike()` chains instead of `.or()` with interpolation
- `src/components/pos/POSCustomerSelect.tsx` — Same refactor

## Verification goals

- [x] Every database query uses Supabase SDK methods (parameterized by PostgREST)
- [x] No raw SQL queries with user input concatenated
- [x] No string concatenation, f-strings, or template literals in actual SQL statements
- [x] grep for dangerous patterns (raw SQL) returns nothing

## Manual verification (for the human)

- Try searching with special characters like `%`, `_`, `.`, `,` in the product search to verify results are still safe
