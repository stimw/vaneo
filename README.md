# Vaneo

Vaneo is an independent, self-hosted project management application maintained by
[stimw](https://github.com/stimw). It starts from
[Kaneo 2.46.2](https://github.com/usekaneo/kaneo/tree/v2.46.2), with the original
source history and MIT attribution preserved.

The initial **0.1.0** build retains Kaneo's existing functionality. The planned
product direction is:

- Time-entry UI, summaries and exports for the development team.
- Customer submissions for requirements and bugs, linked to one or more internal
  tasks after review.
- Separate permissions for submissions, internal tasks, worklogs and exports.

These planned features have not been implemented yet. Development and releases
follow Vaneo's own roadmap; upstream changes are reviewed only when relevant.

## Development

Follow [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for local setup. Internal
`@kaneo` package names, `KANEO_*` runtime variables and the existing Dockerfile
name are retained for compatibility.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Images and deployment

[GitHub Actions](https://github.com/stimw/vaneo/actions) runs checks and builds the
bundled app using `Dockerfile.kaneo` on standard GitHub-hosted runners. Successful
main builds publish public images to `ghcr.io/stimw/vaneo`:

- `sha-<full-source-commit>` identifies the build.
- `latest` tracks the latest successful main build.

Production deployments select a tested image and pin its digest in a separate
deployment repository. Publishing an image does not deploy production. Keep
credentials, private configuration and customer data outside this public source
repository.

For a local build:

```sh
docker build -f Dockerfile.kaneo -t vaneo:dev .
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and versioning rules.

## License and origin

[MIT](LICENSE). Vaneo is derived from Kaneo, originally developed by Andrej
Acevski and its contributors. The original license and copyright notice remain
in `LICENSE`.
