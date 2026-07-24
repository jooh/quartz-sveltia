# Basic consumer

Copy `sveltia.config.yml` to the root of a Quartz 5 project, copy the plugin entry from `quartz.config.yaml` into that project's `plugins` list, and keep the sample content or adapt the collection to your vault.

Install the plugin with:

```sh
npx quartz plugin add github:jooh/quartz-sveltia
```

For local builds, set `GITHUB_REPOSITORY=owner/repository` or put a literal repository in `backend.repo`. After `npx quartz build`, open `/admin/` through a local HTTP server.
