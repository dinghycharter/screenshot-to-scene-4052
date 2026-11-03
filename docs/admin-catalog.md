# Catalog administration

The catalog panel is available at `/admin/catalog`. The page checks the signed-in user's Supabase Auth `app_metadata.role`; the database migration enforces the same role for all writes with row-level security.

## Enable catalog administration

1. Apply `drizzle/migrations/0002_admin_catalog_management.sql` to the intended Supabase project (for example, in the Supabase SQL Editor).
2. In Supabase **Authentication → Users**, open the account that should administer the catalog and set its **app metadata** to:

   ```json
   { "role": "admin" }
   ```

3. Sign out and sign back in so Supabase issues a refreshed access token.

Do not set this in user metadata or a profile field: users can edit those fields themselves. Only trusted app metadata is checked by the database policy.

Class deletion is blocked by the existing foreign key if boats use that class. Reassign those boats before removing the class.
