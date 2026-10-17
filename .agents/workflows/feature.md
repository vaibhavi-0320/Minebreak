# Workflow — Feature / fix

Use for gameplay, UI, audio wiring, or architecture-touching changes.

## 0. Classify

- **Hot path?** (Player, Mobs, store, runtime, collision, navigation) → read
  `docs/ARCHITECTURE.md` + latest `docs/MEMORY.md` first.
- **Visual only?** → read `docs/DESIGN.md`.
- **One-liner fix?** → skip plan; still typecheck.

## 1. Plan (if multi-file)

State in chat (brief):

- Goal + acceptance (“mobs path around cottage”)
- Files you will touch
- Risks (perf, store thrash, invuln, audio unlock)

## 2. Implement

Follow `AGENTS.md` hard rules:

- Motion in `useFrame` / runtime; rare store patches
- Reuse `collision` / `navigation` / `audio` APIs
- Once-per-hit flags; no center modals mid-fight
- Keep attribution

## 3. Verify

```bash
npm run typecheck
# if UI or public assets changed:
npm run build
```

Then `.agents/checklists/gameplay.md` smoke for combat/nav/UI.

## 4. Record

If you hit a footgun, append to `docs/MEMORY.md`.

## 5. Commit (when asked)

Conventional Commit; no AI trailers. Example:

```
feat(nav): sticky wall-follow when path blocked
```
