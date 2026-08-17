# Auth hotfix 28

Root cause: `src/db.js` referenced the IndexedDB helper `tx(...)` without defining it. Any `DB.all('users')` call therefore failed before ADMIN credentials could be checked, making the login button appear to do nothing.

The fix restores a Promise-based IndexedDB transaction helper with request and transaction error handling. No user data is cleared and ADMIN / ADMINB1 remains unchanged.