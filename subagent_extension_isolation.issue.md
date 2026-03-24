# Title

Subagent child workers inherit ambient `pi` extensions, which can make worker runs hang or behave nondeterministically

# Summary

`pi-subagents` launches child `pi` workers in print/json mode, but those workers currently inherit the caller's ambient extension set unless extensions are explicitly overridden.

That is the wrong default for worker subprocesses:

- it makes subagent execution depend on the operator's local/global extension environment
- interactive/background extensions can leak user-session behavior into one-shot worker runs
- child workers can hang after producing their final output if an inherited extension keeps the event loop alive

Subagent workers should launch with `--no-extensions` by default, then opt back into only the explicitly requested extension paths needed for that worker.

# Impact

- Subagent behavior depends on the ambient extension configuration of the machine running `pi-subagents`.
- A worker can finish its answer but fail to exit, causing the parent `pi-subagents` process to wait forever.
- Different users can get different worker behavior for the same agent/task definition.

# Reproduction

One concrete reproduction came from a global extension environment where a user-facing extension started a timer on `session_start` and only cleared it on `session_shutdown`.

When `pi-subagents` launched a child worker in print/json mode without `--no-extensions`:

1. the child inherited that ambient extension
2. the extension started background work intended for interactive sessions
3. the assistant finished its response
4. the worker process stayed alive instead of exiting
5. `pi-subagents` hung waiting for child process completion

The visible last output in the stuck session was a `Ready for input` notification from another inherited extension, which made the problem appear like a subagent hang even though the worker had already completed its answer.

# Expected Behavior

Subagent workers should be isolated from ambient extension state by default.

Only these extensions should be loaded for a worker run:

- extension paths explicitly requested for that subagent
- extension paths implied by path-based tool entries

# Root Cause

`buildPiArgs()` did not pass `--no-extensions`, so child `pi` workers inherited whatever ambient extensions the parent environment auto-loaded.

That made worker correctness and termination dependent on unrelated user/global extension behavior.

# Proposed Fix

In `buildPiArgs()`:

1. always add `--no-extensions` for subagent worker runs
2. if the subagent explicitly specifies `extensions`, re-add those with `--extension <path>`
3. if a tool entry is actually an extension path, preserve that behavior by re-adding the path as `--extension <path>`

# Notes

This is a defense-in-depth fix even if `pi` itself also improves one-shot extension teardown.

Subagent workers are deterministic subprocesses, not interactive user sessions, so ambient extension inheritance should not be the default behavior.
