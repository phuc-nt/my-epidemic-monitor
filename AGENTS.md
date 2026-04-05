# AGENTS.md

Universal project instructions for AI coding agents.
Compatible with: Codex CLI, GitHub Copilot, Cursor, Windsurf, Amp, Devin, Gemini CLI, Claude Code (fallback).

## Role & Responsibilities

You are an AI coding agent. Analyze user requirements, delegate tasks to sub-agents when available, and deliver features that meet specifications and architectural standards.

## Workflows

Read and follow these workflow files in order of priority:

1. **Primary workflow:** `./.claude/rules/primary-workflow.md` — plan → implement → test → review → ship
2. **Development rules:** `./.claude/rules/development-rules.md` — code quality, naming, testing, pre-commit
3. **Orchestration protocol:** `./.claude/rules/orchestration-protocol.md` — how to delegate to sub-agents
4. **Documentation management:** `./.claude/rules/documentation-management.md` — docs structure, plan format
5. **Team coordination:** `./.claude/rules/team-coordination-rules.md` — multi-agent collaboration rules

## Development Principles

- **YAGNI** — You Aren't Gonna Need It. Don't over-engineer.
- **KISS** — Keep It Simple, Stupid. Prefer simple solutions.
- **DRY** — Don't Repeat Yourself. Eliminate code duplication.
- **Modularization** — If a code file exceeds 200 lines, consider splitting it.
- **Kebab-case naming** — Use long descriptive file names so agents can understand purpose from name alone.
- **Real implementations only** — No mocks, fakes, or temporary solutions to pass builds.

## Code Quality

- Write clean, readable, maintainable code
- Follow established architectural patterns in the codebase
- Handle edge cases and error scenarios
- Use try-catch error handling and cover security standards
- Run linting before commit, tests before push
- Do NOT ignore failing tests just to pass the build
- Do NOT commit secrets (.env, API keys, credentials)

## Workflow Steps

### Feature Development
1. **Plan** — Create implementation plan with phases in `./plans/`
2. **Research** — Investigate technical approaches, read existing code
3. **Implement** — Write code following `./docs/code-standards.md`
4. **Test** — Write comprehensive tests, ensure coverage
5. **Review** — Check code quality, security, standards compliance
6. **Document** — Update `./docs/` if architecture or APIs changed

### Bug Fixing
1. Read error logs and stack traces
2. Find root cause (don't guess — prove it)
3. Implement fix
4. Run tests to verify fix + no regressions

### Debugging
1. Reproduce the issue
2. Analyze logs, traces, and state
3. Identify root cause
4. Fix and verify with tests

## Skills

This project includes 80+ domain knowledge packs in `.claude/skills/`. Each skill is a folder with a `SKILL.md` file containing instructions, references, and optional scripts.

**Key skills:**
| Skill | Purpose |
|---|---|
| `cook` | Full workflow: plan → code → test → review |
| `fix` | Structured bug diagnosis and fix |
| `test` | Run tests with coverage |
| `code-review` | Code quality review |
| `ship` | Full pipeline to production |
| `mk-plan` | Create implementation plans |
| `mk-autoresearch` | Autonomous metric optimization loop |
| `mk-problem-solving` | 6 techniques for breaking through blockers |
| `docs` | Generate/update project documentation |
| `git` | Commit, push, branch management |
| `mk-debug` | Deep debugging with analysis |
| `sequential-thinking` | Step-by-step problem analysis |

Activate skills relevant to the current task. Browse `.claude/skills/` for the full catalog.

## Agents

14 specialist agents are defined in `.claude/agents/`:

| Agent | Role |
|---|---|
| `planner` | Creates phased implementation plans |
| `tester` | Runs tests, ensures coverage |
| `code-reviewer` | Reviews for quality, security, standards |
| `debugger` | Root cause analysis and fixes |
| `researcher` | Technical research and best practices |
| `scout` | Fast codebase exploration |
| `fullstack-developer` | Implementation across stack |
| `docs-manager` | Documentation updates |
| `git-manager` | Git operations |
| `brainstormer` | Idea generation and analysis |
| `project-manager` | Roadmap and milestone tracking |
| `simplifier` | Code simplification |
| `team-lead` | Multi-agent coordination |
| `scout-external` | External research |

## Documentation

Project docs live in `./docs/`:

```
./docs/
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── system-architecture.md
└── project-roadmap.md
```

Always read `./README.md` first for project context. Update docs when architecture or APIs change.

## Plans

Save implementation plans in `./plans/` with timestamp naming:

```
plans/
└── 260401-1505-feature-name/
    ├── plan.md              # Overview (< 80 lines)
    ├── phase-01-setup.md    # Detailed phase files
    ├── phase-02-impl.md
    ├── research/            # Research reports
    └── reports/             # Agent reports
```

## Git Conventions

- Use conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Keep commits focused on actual code changes
- No AI references in commit messages
- Do NOT commit confidential information

## Important Rules

- **Read `./README.md` first** before planning or implementing anything
- **Follow development rules** in `./.claude/rules/development-rules.md` strictly
- **Sacrifice grammar for concision** in reports
- **List unresolved questions** at the end of reports
- **Do NOT create new enhanced files** — update existing files directly
