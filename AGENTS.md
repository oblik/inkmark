# Notes for coding agents

## Commits

1. Short, plain messages, for example "Add arrow heads".
2. No AI trailers (no "Co-Authored-By", no "Generated with") and no signing.
3. Never commit secrets, personal emails, company names or absolute paths like `/Users/...`.

## Versions

The package is `@oblik/inkmark`. It uses semver and stays on `0.x` until the API is stable.

1. Bug fix, no API change: `npm version patch` (0.1.0 → 0.1.1).
2. New feature or breaking change: `npm version minor` (0.1.1 → 0.2.0).
3. `1.0.0` only when the owner decides the API is stable.
4. Write each change under "Unreleased" in `CHANGELOG.md`. On release, rename "Unreleased" to the new version and date.

## Release

1. `npm test && npm run typecheck`
2. Move "Unreleased" in `CHANGELOG.md` to the new version, and commit.
3. `npm version patch` or `npm version minor`. This makes a commit and a `vX.Y.Z` tag.
4. `git push --follow-tags`
5. `npm publish`. It runs the tests and the build first.

A published version can never be published again. Each fix needs a new version.
