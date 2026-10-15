# Vaneo

Vaneo is an independent, self-hosted project management application maintained by
[stimw](https://github.com/stimw). It starts from
[Kaneo 2.46.2](https://github.com/usekaneo/kaneo/tree/v2.46.2), with the original
source history and MIT attribution preserved.

Vaneo retains Kaneo's task and project functionality and adds browser image
compression, an editable task time total and completion-period reports. More detailed
permissions for internal tasks and exports remain planned.

Development and releases follow Vaneo's own roadmap. Relevant upstream changes,
including improvements to the time-entry UI, can be adopted selectively.

## Time tracking and reports

The task properties sidebar shows **Time**. Open it to set one total in hours
(for example, `2.5` for two and a half hours), then save or press Enter.
Project participants can read it; setting the total requires `timeEntry:update`
in Workspace settings → Roles. Members, admins and owners have this permission
by default; custom client roles do not unless explicitly granted. Editing tasks
does not grant permission to edit time.

Existing time entries are preserved for CLI/MCP use and initialize the total on
upgrade. New closed entries add their time; editing an entry adjusts the total
by its duration difference. Running entries add time when stopped. Manual total
corrections do not delete or rewrite previous entries.

Under **Project settings → General → Tasks → Completed tasks & time**, choose
an inclusive completion date range and download JSON. Dates use the browser's
time zone. The report includes each selected task's current total, any historical
time entries (even outside the period), and an overall total in seconds. Manual
corrections are reflected in the totals, so those can differ from the old entry
sum. Running entries are listed but excluded until stopped.

Completion follows the project's final workflow columns. Ordinary edits do not
change a completion date; reopening clears it, and completing again records a
new date. Completed tasks retain that date when archived. Existing completion
dates are recovered from status history when available; older completed tasks
without a known date are excluded and counted in `unknownCompletionCount`.

Agents can use the built-in `export_completed_tasks` MCP tool or call
`GET /api/task/completed-export/{projectId}` with `from` (inclusive), `to`
(exclusive) and `timeZone`. CLI users can access it through `kaneo api`.
Use `get_task_time` / `set_task_time` in MCP or
`GET` / `PUT /api/time-entry/task/{taskId}/total` for the editable task total.

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
