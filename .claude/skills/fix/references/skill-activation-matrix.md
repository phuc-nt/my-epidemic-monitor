# Skill Activation Matrix

When to activate each skill and tool during fixing workflows.

## Always Activate (ALL Workflows)

| Skill/Tool | Step | Reason |
|------------|------|--------|
| `mk:scout` OR parallel `Explore` | Step 1 | Understand codebase context before diagnosing |
| `mk:debug` | Step 2 | Systematic root cause investigation |
| `mk:sequential-thinking` | Step 2 | Structured hypothesis formation — NO guessing |

## Task Orchestration (Moderate+ Only)

| Tool | Activate When |
|------|---------------|
| `TaskCreate` | After complexity assessment, create all phase tasks upfront |
| `TaskUpdate` | At start/completion of each phase |
| `TaskList` | Check available unblocked work, coordinate parallel agents |
| `TaskGet` | Retrieve full task details before starting work |

Skip Tasks for Quick workflow (< 3 steps). See `references/task-orchestration.md`.

## Auto-Triggered Activation

| Skill | Auto-Trigger Condition |
|-------|------------------------|
| `mk:problem-solving` | 2+ hypotheses REFUTED in Step 2 diagnosis |
| `mk:sequential-thinking` | Always in Step 2 (mandatory for hypothesis formation) |

## Conditional Activation

| Skill | Activate When |
|-------|---------------|
| `mk:brainstorm` | Multiple valid fix approaches, architecture decision (Deep only) |
| `mk:context-engineering` | Fixing AI/LLM/agent code, context window issues |
| `mk:ai-multimodal` | UI issues, screenshots provided, visual bugs |
| `mk:project-management` | Moderate+ workflows — task hydration, sync-back, progress tracking |

## Subagent Usage

| Subagent | Activate When |
|----------|---------------|
| `debugger` | Root cause unclear, need deep investigation (Step 2) |
| `Explore` (parallel) | Scout multiple areas simultaneously (Step 1), test hypotheses (Step 2) |
| `Bash` (parallel) | Verify implementation: typecheck, lint, build, test (Step 5) |
| `researcher` | External docs needed, latest best practices (Deep only) |
| `planner` | Complex fix needs breakdown, multiple phases (Deep only) |
| `tester` | After implementation, verify fix works (Step 5) |
| `mk:code-review` | After fix, verify quality and security (Step 5) |
| `git-manager` | After approval, commit changes (Step 6) |
| `docs-manager` | API/behavior changes need doc updates (Step 6) |
| `project-manager` | Major fix impacts roadmap/plan status (Step 6) |
| `fullstack-developer` | Parallel independent issues (each gets own agent) |

## Parallel Patterns

See `references/parallel-exploration.md` for detailed patterns.

| When | Parallel Strategy |
|------|-------------------|
| Scouting (Step 1) | 2-3 `Explore` agents on different areas |
| Testing hypotheses (Step 2) | 2-3 `Explore` agents per hypothesis |
| Multi-module fix | `Explore` each module in parallel |
| After implementation (Step 5) | `Bash` agents: typecheck + lint + build + test |
| 2+ independent issues | Task trees + `fullstack-developer` agents per issue |

## Workflow → Skills Map

| Workflow | Skills Activated |
|----------|------------------|
| Quick | `mk:scout` (minimal), `mk:debug`, `mk:sequential-thinking`, `mk:code-review`, parallel `Bash` verification |
| Standard | Above + Tasks, `mk:problem-solving` (auto), `mk:project-management`, `tester`, parallel `Explore` |
| Deep | All above + `mk:brainstorm`, `mk:context-engineering`, `researcher`, `planner` |
| Parallel | Per-issue Task trees + `mk:project-management` + `fullstack-developer` agents + coordination via `TaskList` |

## Step → Skills Chain (Mandatory Order)

| Step | Mandatory Chain |
|------|----------------|
| Step 0: Mode | `AskUserQuestion` (unless auto/quick detected) |
| Step 1: Scout | `mk:scout` OR 2-3 parallel `Explore` → map files, deps, tests |
| Step 2: Diagnose | Capture pre-fix state → `mk:debug` → `mk:sequential-thinking` → parallel `Explore` hypotheses → (`mk:problem-solving` if 2+ fail) |
| Step 3: Assess | Classify complexity → create Tasks (moderate+) |
| Step 4: Fix | Implement per workflow → follow root cause |
| Step 5: Verify+Prevent | Iron-law verify → regression test → defense-in-depth → parallel `Bash` verify |
| Step 6: Finalize | Report → `docs-manager` → `TaskUpdate` → `git-manager` → `/mk:journal` |

## Detection Triggers

| Keyword/Pattern | Skill to Consider |
|-----------------|-------------------|
| "AI", "LLM", "agent", "context" | `mk:context-engineering` |
| "stuck", "tried everything" | `mk:problem-solving` |
| "complex", "multi-step" | `mk:sequential-thinking` |
| "which approach", "options" | `mk:brainstorm` |
| "latest docs", "best practice" | `researcher` subagent |
| Screenshot attached | `mk:ai-multimodal` |
