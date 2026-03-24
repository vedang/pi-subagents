# Title

fix(subagent): isolate child worker extension loading

# Summary

This PR makes `pi-subagents` launch child `pi` workers with `--no-extensions` by default.

Before this change, worker subprocesses inherited the ambient extension set from the runtime environment unless extensions were explicitly overridden. That meant subagent behavior depended on unrelated global/user extension state, and some inherited extensions could keep a one-shot worker alive after it had already finished its answer.

With this change, worker runs are isolated by default and only opt back into explicit extension paths.

Closes #<ISSUE_NUMBER>

# Root Cause

`buildPiArgs()` assembled the child `pi` command line without `--no-extensions`.

Because `pi` auto-loads ambient extensions, child workers unintentionally inherited user/global extensions that were never requested by the subagent definition.

# Changes

- always pass `--no-extensions` for subagent worker runs
- preserve explicitly requested `extensions` by re-adding them via `--extension <path>`
- preserve path-based tool extensions so tool-backed extension paths keep working
- keep session wiring behavior unchanged (`--session` vs `--session-dir` / `--no-session`)

# Why This Is The Right Default

Subagent workers are one-shot subprocesses. They should be configured from the subagent request itself, not from ambient operator state.

This change makes worker execution:

- more deterministic across machines
- less vulnerable to interactive/background extensions leaking into worker mode
- less likely to hang on process exit

# Testing

Added regression coverage for `buildPiArgs()` to verify:

- ambient extensions are disabled by default
- explicit extension paths are still passed through
- path-based tool extensions are still passed through
- session wiring still uses `--session` when a session file is provided and `--session-dir` otherwise

# Manual Validation

Verified that the previously hanging subagent-worker scenario now exits cleanly once the assistant finishes, because the child worker no longer inherits unrelated ambient extensions.

# Notes

This change is intentionally scoped to worker isolation in `pi-subagents`.

It complements upstream fixes in `pi` itself: even if one-shot extension teardown improves there, `pi-subagents` should still avoid inheriting ambient extensions by default.
