# Workflow — Ship (build + deploy)

## Preflight

- [ ] Feature complete per acceptance criteria
- [ ] `npm run typecheck` green
- [ ] `npm run lint` green (if TS/TSX changed)
- [ ] `npm run build` green
- [ ] Gameplay smoke (`.agents/checklists/gameplay.md`)
- [ ] Attribution + SEO still present if you touched HTML/HUD
- [ ] No secrets in diff (`git diff` for keys)

## Deploy (Vercel)

Project is already linked (`.vercel/`).

```bash
npx vercel --prod --yes
```

Confirm alias: **https://embervale-amber.vercel.app**

## Post-deploy

- [ ] Open prod URL; title loads
- [ ] Enter grove once (audio + combat sanity)
- [ ] Optional: update `public/sitemap.xml` `lastmod` if content meaningfully changed

## Git

Prefer:

1. Commit on a branch
2. PR with `.github/PULL_REQUEST_TEMPLATE.md`
3. Squash merge to `main`

Do not force-push `main`. Do not deploy broken `typecheck`.
