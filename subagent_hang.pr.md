# Title

fix(print-mode): emit `session_shutdown` for one-shot runs

# Summary

This PR fixes an extension lifecycle asymmetry in print/json mode.

Before this change, one-shot runs (`-p` / `--mode json`) bound extensions and emitted `session_start`, but the print-mode path returned without `session_shutdown`.

As a result, extensions that started timers/watchers on `session_start` and cleaned them up on `session_shutdown` could keep the process alive after the assistant had already finished.

Closes #<ISSUE_NUMBER>

# Root Cause

`runPrintMode()` uses `session.bindExtensions(...)`, so print/json runs participate in the extension lifecycle.

Unlike interactive shutdown paths, the one-shot path does not perform extension teardown before returning, so referenced timers/watchers can keep the Node process alive.

# Changes

- emit extension teardown for print/json mode so one-shot runs receive `session_shutdown` before returning
- preserve normal print/json output semantics
- keep interactive mode behavior unchanged

# Reproduction Before

```bash
pi --mode json \
  --session-dir /tmp/pi-hang-repro \
  --no-extensions \
  --extension ~/.pi/agent/extensions/mac-system-theme.ts \
  --extension ~/.pi/agent/extensions/notify.ts \
  --models openai-codex/gpt-5.4 \
  -p 'Task: Reply with exactly DONE and nothing else.'
```

Before this PR:

- assistant completes
- `Ready for input` is emitted
- process hangs instead of exiting

# Behavior After

With this PR applied:

- assistant completes
- extension teardown runs
- `session_shutdown` is emitted
- the process exits cleanly

# Testing

## Manual

Verified the repro command above exits cleanly after the final assistant response.

## Regression Coverage

Recommended coverage for this PR:

- a test extension that starts a timer on `session_start`
- clears it on `session_shutdown`
- verify print/json mode exits cleanly when the run completes

# Notes

`pi-subagents` now mitigates this downstream by launching child workers with `--no-extensions` by default, but `pi` should still guarantee correct lifecycle teardown in one-shot mode for direct use and for subprocess consumers.
