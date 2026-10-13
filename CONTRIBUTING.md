# Contributing to Vaneo

Vaneo is an independent project maintained by `stimw`, derived from Kaneo 2.46.2.
Discuss substantial changes with the maintainer before implementing them.

## Product direction

- Internal time tracking, summaries and export.
- Customer requirements and bug submissions, reviewed and split into internal
  tasks while preserving links to their original submissions.
- Permissions that distinguish clients, internal staff, resource ownership and
  access to worklogs and exports.

These are roadmap items, not completed features in the initial 0.1.0 build.

## Releases and versions

Vaneo uses its own semantic versions, beginning at `0.1.0`:

- Patch: fixes compatible with the current release.
- Minor: new functionality compatible with the current release.
- Major: incompatible API, workflow or data-contract changes.

While the version is below 1.0.0, document incompatible changes explicitly in
release notes. Git release tags use `v<version>`, while image release tags omit
`v`. Preserve published tags; a release identifies one reviewed source commit.

Current CI publishes `ghcr.io/stimw/vaneo:sha-<full-commit-sha>` and updates `latest`
after successful main builds. Version-tagged image publication must be wired into
CI before the first tagged release. Production deployment remains a separate
operation and pins the image digest.

## Upstream policy and provenance

Vaneo does not automatically synchronize or routinely merge upstream releases.
Its initial base is Kaneo `v2.46.2`, commit
`46ef6f78da1f0c9630d88c56f1686ebfc8de7beb`. Preserve the original history, license
and attribution. Review relevant fixes individually and record their source if
adapted. Upstream versions do not determine Vaneo's release numbers.

The inherited upstream release, website, package publication and notification
workflows are restricted to `usekaneo/kaneo`. The active workflow in this project
is `.github/workflows/vaneo.yml`.

## Development and verification

Follow [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) and [AGENTS.md](AGENTS.md).
Keep changes focused and use conventional commit messages. Internal `@kaneo`
package names and runtime configuration keys are retained for compatibility.

```sh
pnpm lint
pnpm typecheck
pnpm test
```

Run affected integration tests for database, routing and authorization changes.
Schema changes need reviewed Drizzle migrations; changes to API contracts also
need the generated OpenAPI reference updated. Enforce permissions in the API,
including resource ownership and workspace/project isolation.

Never commit credentials, private environment files, customer data or deployment
state. Use test-only data and credentials for development. Retain the original
MIT copyright notice when modifying or redistributing the source.
