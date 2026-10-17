# `.agents/` — Embervale harness companions

Root law: **`AGENTS.md`** (symlinked as `CLAUDE.md`).

This folder holds **playbooks and checklists** so multi-session agents do not
reinvent process. Prefer linking here from chats over pasting long prompts.

```
.agents/
  README.md
  workflows/
    feature.md    # implement a gameplay/UI feature
    ship.md       # typecheck, build, deploy
    assets.md     # Blender GLB pipeline
    sfx.md        # ElevenLabs sound set
  checklists/
    pr.md         # PR body / review
    gameplay.md   # smoke test in browser
```

## How agents should use this

1. Read `AGENTS.md` hard rules.
2. Open the matching workflow before multi-step work.
3. Tick the checklist before claiming done.
4. Append durable lessons to `docs/MEMORY.md`.

## What does *not* live here

- Product marketing → `README.md`
- Deep architecture → `docs/ARCHITECTURE.md`
- Feel / palette → `docs/DESIGN.md`
- Secrets → never (env only)
