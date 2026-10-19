# Vaneo

Vaneo is an independent, self-hosted project management application maintained by
[stimw](https://github.com/stimw). It starts from
[Kaneo 2.46.2](https://github.com/usekaneo/kaneo/tree/v2.46.2), with the original
source history and MIT attribution preserved.

Vaneo retains Kaneo's task and project functionality and adds browser image
compression, dated work logs, cumulative task time and project time reports. More detailed
permissions for internal tasks and exports remain planned.

Development and releases follow Vaneo's own roadmap. Relevant upstream changes,
including improvements to the time-entry UI, can be adopted selectively.

## Time tracking and reports

The task properties sidebar shows **Time spent**. Open it to log hours against a work
date, or edit and remove an existing dated log. New logs and corrections use
15-minute increments, with a minimum of 15 minutes. Historical allocations may
exceed 24 hours on one date. The cumulative total updates automatically;
overwriting it directly is no longer supported.

Project participants can read time. Logging, editing and deleting require the
corresponding `timeEntry:create`, `timeEntry:update` and `timeEntry:delete`
permissions in Workspace settings → Roles. The default Client role can view
time but cannot modify it. Editing tasks does not grant permission to edit time.

The **Time logged** report counts dated work logs and stopped timer entries in
the selected period, including work on ongoing tasks. Existing undated historical
balances remain visible in cumulative totals but are excluded from period reports.
Existing timer entries remain available through the CLI and MCP. Running timers
add to cumulative totals when stopped; changing a closed entry adjusts the total
by its duration difference.

Under **Project settings → General → Tasks → Completed tasks & time**, choose
an inclusive completion date range and download JSON. Dates use the browser's
time zone. The report includes each selected task's current total, any historical
time entries (even outside the period), and an overall total in seconds. Cumulative
totals include dated work logs and existing historical balances, so those can
differ from the old timer entry sum. Running entries are listed but excluded
until stopped.

Completion follows the project's final workflow columns. Ordinary edits do not
change a completion date; reopening clears it, and completing again records a
new date. Completed tasks retain that date when archived. Existing completion
dates are recovered from status history when available; older completed tasks
without a known date are excluded and counted in `unknownCompletionCount`.

Agents can use the built-in `export_completed_tasks` MCP tool or call
`GET /api/task/completed-export/{projectId}` with `from` (inclusive), `to`
(exclusive) and `timeZone`. CLI users can access it through `kaneo api`.
Use `get_task_time` in MCP or `GET /api/time-entry/task/{taskId}/total` to read
cumulative task time. Read and create dated logs with `GET` / `POST` at
`/api/time-entry/task/{taskId}/logs`; edit or delete them with `PUT` / `DELETE`
at `/api/time-entry/task/{taskId}/logs/{id}`. Writes to the old absolute-total
endpoint have been removed.

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
