# Checklist — Pull request

## Description

Use `.github/PULL_REQUEST_TEMPLATE.md`. Fill sections truthfully.

## Before open

- [ ] Conventional title (`feat:`, `fix:`, …)
- [ ] `npm run typecheck` green
- [ ] `npm run lint` green (if applicable)
- [ ] `npm run build` green for mainline-bound work
- [ ] Gameplay smoke if combat/nav/UI touched
- [ ] No secrets in the diff
- [ ] No AI co-author trailers
- [ ] `docs/MEMORY.md` updated if a durable gotcha was found
- [ ] Attribution / SEO intact if HTML or HUD changed

## Review focus (for reviewers)

- Runtime vs store boundary respected?
- Collision / navigation not regressed?
- Once-per-hit and invuln logic safe?
- Audio unlock still gesture-gated?
- Diff minimal and on-task?
