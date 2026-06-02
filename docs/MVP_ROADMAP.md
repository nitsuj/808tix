# MVP backlog

Deferred work after June 10 MVP scope.

## Pass recipient names

- **TODO:** Split `passes.guest_name` into `guest_first_name` and `guest_last_name` columns.
- **Current:** Issue Pass collects first + last in the UI and stores `"${first_name} ${last_name}"` in `guest_name`.
- **When splitting:** Migrate existing `guest_name` values; update issue form insert, pass lists, guest pass, scanner, and Apple Wallet field mapping.
