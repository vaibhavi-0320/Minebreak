## Summary

<!-- What changed and why (1–5 sentences). -->

## Type

- [ ] `feat` — new behavior
- [ ] `fix` — bug fix
- [ ] `refactor` — no intended behavior change
- [ ] `docs` — harness / README / comments
- [ ] `chore` — tooling, deps, assets regen
- [ ] `perf` — performance

## Quality gate

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes (if TS/TSX touched)
- [ ] `npm run build` passes (required for mainline)
- [ ] Gameplay smoke done (if combat / nav / UI / audio)

## Risk

- [ ] Low — isolated / UI copy
- [ ] Medium — combat, AI, collision
- [ ] High — store phase machine, deploy, SEO

## Notes for reviewers

<!-- Screenshots, repro steps, or “see docs/MEMORY.md”. -->

## Checklist

- [ ] No secrets committed
- [ ] No AI attribution / co-author trailers
- [ ] Attribution to carlomigueldy.dev preserved (if UI/HTML touched)
- [ ] Durable learnings appended to `docs/MEMORY.md` (if any)
