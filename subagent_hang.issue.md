# Title

Print/json mode binds extensions but does not emit `session_shutdown`, so extension timers/watchers can keep one-shot runs alive

# Summary

One-shot `pi` runs (`-p` and `--mode json`) bind extensions and emit startup events, but they do not emit `session_shutdown` before returning.

An extension that starts background work on `session_start` and cleans it up on `session_shutdown` can therefore keep the process alive after the assistant has already finished its turn.

This surfaced downstream in `pi-subagents`, where child workers are launched with `pi --mode json -p ...` and the parent waits for child process exit.

# Reproduction

Using these two global extensions:

- `~/.pi/agent/extensions/mac-system-theme.ts`
  - starts a `setInterval(...)` on `session_start`
  - clears it on `session_shutdown`
- `~/.pi/agent/extensions/notify.ts`
  - emits `Ready for input` on `agent_end`

Run:

```bash
pi --mode json \
  --session-dir /tmp/pi-hang-repro \
  --no-extensions \
  --extension ~/.pi/agent/extensions/mac-system-theme.ts \
  --extension ~/.pi/agent/extensions/notify.ts \
  --models openai-codex/gpt-5.4 \
  -p 'Task: Reply with exactly DONE and nothing else.'
```

## Actual

- the assistant emits its final `message_end` / `DONE`
- `notify.ts` emits `Ready for input`
- the process does **not** exit and must be killed manually

## Expected

Once the one-shot run is finished, `pi` should tear extensions down and exit cleanly.

# Root Cause

`packages/coding-agent/src/modes/print-mode.ts` binds extensions via `session.bindExtensions(...)`, which emits `session_start`.

The print/json path then returns without a matching teardown step, so `session_shutdown` is never emitted for these one-shot runs. Any referenced timer or watcher therefore keeps the Node process alive.

This is a lifecycle bug, not an invalid extension pattern: starting background work on `session_start` and cleaning it up on `session_shutdown` is the expected lifecycle shape.

# Proposed Fix

Ensure one-shot runs emit `session_shutdown` before returning.

Possible approaches:

1. Add a dedicated `AgentSession` shutdown method for extensions/resources and call it from the print/json path.
2. Or emit `session_shutdown` directly from the print/json flow before stdout restoration/return.
3. Add a regression test with an extension that starts a timer on `session_start` and clears it on `session_shutdown`.

# Notes

`pi-subagents` now mitigates this downstream by launching child workers with `--no-extensions` by default, but the underlying print/json lifecycle asymmetry still exists in `pi` and should be fixed upstream.
