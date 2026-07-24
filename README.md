# @jooh/quartz-sveltia

A standalone Quartz 5 emitter that publishes a [Sveltia CMS](https://sveltiacms.app/) admin app at `<output>/<route>/`. Each emission creates two sibling files:

```text
public/
└── admin/
    ├── index.html
    └── config.yml
```

Sveltia automatically loads `config.yml` beside `index.html`, so the generated page works at a domain root and beneath a GitHub Pages project path without a root-relative config link.

## Install

Quartz 5 installs community plugins from Git repositories:

```sh
npx quartz plugin add github:jooh/quartz-sveltia
npx quartz plugin enable quartz-sveltia
```

Configure the installed plugin in `quartz.config.yaml`:

```yaml
plugins:
  # ...the rest of your Quartz plugins...
  - source: github:jooh/quartz-sveltia
    enabled: true
    options:
      configFile: sveltia.config.yml
      route: admin
```

Create `sveltia.config.yml` in the Quartz project root. The [basic example](examples/basic/sveltia.config.yml) edits Markdown with frontmatter, stores media where Quartz can publish it, and restricts GitHub authentication to token entry through Sveltia's UI.

The configured route must be owned exclusively by this emitter. Quartz's built-in Assets emitter copies non-Markdown content files concurrently during a full build, so remove or relocate pre-existing files such as `content/admin/index.html` and `content/admin/config.yml` (or their equivalents for a custom route). Otherwise, two emitters can race to write the same destinations and the final content is nondeterministic.

## Options

| Option                  | Default                 | Purpose                                                                   |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------- |
| `configFile`            | required                | Project-relative YAML configuration path.                                 |
| `route`                 | `admin`                 | Safe relative output route; nested values such as `internal/editor` work. |
| `cmsVersion`            | `0.172.2`               | Exact version used to construct the default UNPKG URL.                    |
| `scriptUrl`             | versioned UNPKG URL     | Optional credential-free HTTPS classic bundle URL.                        |
| `repository`            | unset                   | Explicit `owner/repository` placeholder value.                            |
| `repositoryEnv`         | `GITHUB_REPOSITORY`     | Non-secret repository metadata environment variable.                      |
| `repositoryPlaceholder` | `__GITHUB_REPOSITORY__` | Exact source text to replace.                                             |
| `title`                 | `Sveltia CMS`           | Escaped HTML page title.                                                  |

The named and default exports are the same emitter factory:

```ts
import SveltiaCms, {
  SveltiaCms as NamedSveltiaCms,
  DEFAULT_SVELTIA_CMS_VERSION,
  type SveltiaCmsOptions,
} from "@jooh/quartz-sveltia";
```

## Repository resolution

Repository substitution happens only when the exact configured placeholder occurs in the YAML source. Precedence is:

1. `repository`
2. the environment variable named by `repositoryEnv`
3. a build-stopping error that explains both choices and the literal `backend.repo` alternative

If `backend.repo` is already literal, it is preserved even when the option or environment variable is set. The environment is not read in that case. The plugin never inspects Git remotes and refuses credential-like environment variable names.

GitHub Actions already provides `GITHUB_REPOSITORY=owner/repository`, making the placeholder useful in Pages builds. Locally, either export the same non-secret metadata or write a literal repository:

```sh
GITHUB_REPOSITORY=owner/repository npx quartz build
```

Only the placeholder text is replaced. Comments, quoting, whitespace, and unrelated expressions such as `${NAME}` remain untouched. The resolved document is parsed only for validation; it is not reserialized.

## Workflows

For local editing, run a Quartz development server, visit `/admin/`, and choose Sveltia's local repository workflow in a browser that supports the File System Access API. No GitHub authentication is needed for local-only file editing; commit the resulting files with Git yourself. Quartz watches its content directory, not a root-level `sveltia.config.yml`, so a change to only that config may require restarting the development server.

For GitHub-backed editing, visit the deployed `/admin/`, choose “Sign In with Token,” and enter the PAT into Sveltia's own prompt. Sveltia stores it in that browser's local storage and sends requests directly to GitHub. This emitter never receives, reads, substitutes, logs, or writes the PAT. Do not put a PAT, API key, password, or a GitHub Actions secret expression in the YAML, plugin options, repository environment variable, title, or script URL.

Sveltia commits content changes to the configured repository. Those changes appear on the deployed Quartz site only after the repository's build and deployment workflow runs again.

## Security and public deployment

`/admin/` and its `config.yml` are public static assets. The generated `noindex, nofollow` directive is only a crawler hint; it is not access control. Repository names, branches, collection schemas, media paths, and every other config value are visible to visitors. Use repository permissions and Sveltia/GitHub authentication to control writes, and put access control in front of the route if merely viewing the admin app must be restricted.

Emission fails before writing anything when options, paths, repository resolution, YAML, required CMS structure, or credential scans fail. The config must have an object root, an object `backend` with a name, a valid GitHub `owner/repository` when using that backend, and at least one named collection with exactly one usable `folder` or non-empty `files` definition. Errors report a safe category and location without echoing detected values.

Output routes cannot escape the Quartz output directory. Existing symbolic links in the output root or route are rejected. Both artifacts are staged as temporary siblings and individually replaced with atomic renames; if either replacement fails, the emitter rolls back to the complete previous pair.

## GitHub Pages project paths

Use the normal Quartz `baseUrl` for a project site such as `owner.github.io/repository`. The plugin still emits `public/admin/index.html` and `public/admin/config.yml`; when Pages serves that output under `/repository/`, the browser loads `/repository/admin/` and Sveltia requests the sibling `/repository/admin/config.yml`. No plugin option needs the Pages prefix.

## Updating Sveltia CMS

`@sveltia/cms` is pinned exactly as a development-only dependency. Dependabot can propose upgrades, but a version change must update all of the following together:

- `DEFAULT_SVELTIA_CMS_VERSION` and the manifest default
- the exact development dependency and lockfile
- generated URL assertions and documentation
- `CHANGELOG.md`

Run the complete checks and inspect the upstream classic `dist/sveltia-cms.js` bundle before merging an upgrade.

## Development

Requires Node.js 22 or later.

```sh
npm ci
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm run check:declarations
npm run check:externals
npm run check:dist
npm run scan:secrets
```

`dist/` is committed because Quartz consumes prebuilt community plugins without an install-time build. Runtime dependencies such as `yaml` are bundled; no native or install-time dependency is required.

## Scope and limitations

- This plugin emits the static CMS shell and validated YAML. It is not an authentication server, OAuth broker, authorization layer, Quartz deployment service, or CMS preview integration.
- It supports YAML input and always emits `config.yml`; it does not generate site-specific collection schemas.
- Its focused structural validation does not replace Sveltia's complete configuration validation.
- It deliberately does not infer repository details from Git remotes or inject secrets.
- It loads the pinned CMS bundle from an external HTTPS URL by default rather than vendoring Sveltia.
- Incremental emits rerun the whole safe pipeline, but Quartz may not observe a root-level config-only change until restart.
- Git LFS and backend capabilities are Sveltia concerns and are not changed by this emitter.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
