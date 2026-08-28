# M7 packaged acceptance checklist

Use only after deterministic checks pass. This checklist does not import or restore data.

1. Launch `release\Spanish C1 0.2.0.exe` from its permanent folder.
2. In Settings, confirm the displayed active data root is the intended portable `data` folder.
3. Choose **Recheck**. Confirm storage and database are usable. If Ollama/model is degraded, follow the displayed manual guidance; the app must not install, pull, restart, or reconfigure anything.
4. Complete one full 15-minute text session against local Ollama and choose **Finish and save**.
5. Record only aggregate evidence: completion time, completed-session count, weakness count, and whether a delayed review was scheduled. Do not copy learner text or model response into the report.
6. Close the app normally, launch the same executable again, and confirm the completed session appears in History/Progress with the expected weakness/review state.
7. Confirm no phone was connected or required.

Acceptance result:

- M7-AC1: `PASS` / `FAIL`
- M7-AC2 manual history check: `PASS` / `FAIL`
- Notes (aggregate only):
