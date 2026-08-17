# Build verification

Run from `desktop` on Windows or CI:

1. `npm install`
2. `npm run build`
3. Confirm `dist/B-JOB-Setup-0.1.0.exe` exists.
4. Install the EXE.
5. Start B-JOB with network disabled.
6. Confirm the real B-JOB navigation opens.
7. Import real JSON data.
8. Restart while still offline.
9. Confirm imported data remains available.
10. Re-enable network and confirm the app still works; network sync is not required for this stage.
