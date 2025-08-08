# Changelog LLM GitHub Action

A GitHub Action that checks if a PR includes updates to `CHANGELOG.md`
and suggests appropriate changelog entries using GitHub LLM Models if
the updates are missing.

## How It Works

1. When a PR is opened or updated, the action checks if `CHANGELOG.md` was modified
2. If not, it analyzes the PR:
   - Reads PR title and description
   - Examines commit messages
   - Reviews code changes
3. Uses GitHub's LLM models to generate an appropriate changelog entry
4. Posts a comment on the PR with:
   - The suggested changelog category (Added, Changed, Fixed, etc.)
   - A user-focused description of the change
   - The full updated `CHANGELOG.md` content

You also have the option to break the build if `break-build: true`
(default: false) is set, to enforce updates to the changelog.

You can specify a different changelog file with `changelog-path`
option, e.g. `changelog-path: docs/HISTORY.md` (default:
`CHANGELOG.md`).

## Changelog Categories

The action uses standard [Keep a Changelog](https://keepachangelog.com/) categories:

- **Added** - for new features
- **Changed** - for changes in existing functionality
- **Deprecated** - for features that will be removed
- **Removed** - for removed features
- **Fixed** - for bug fixes
- **Security** - for security-related changes

## Setup

### 1. Add the Action to Your Workflow

<details>
<summary>Click to see workflow configuration example</summary>

Create `.github/workflows/changelog-llm.yml` below and **thats it**!

OK, edit the parameters to your liking, like `model`.

```yaml
name: Check Changelog

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write
  models: read  # Required for GitHub Models API

jobs:
  check-changelog:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check and Suggest Changelog
        uses: dotemacs/changelog-llm@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          model: 'gpt-4o-mini'
```
</details>

### 2. GitHub Models Access

**NOTE:** you **don't** have to generate the GitHub token, this is
done automatically during the run.

GitHub Models is available for open source projects. The action uses
the built-in `GITHUB_TOKEN` with `models:read` permission to access
the API. Learn more in [GitHub's announcement](https://github.blog/ai-and-ml/llms/solving-the-inference-problem-for-open-source-ai-projects-with-github-models/).

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token with models:read permission | Yes | - |
| `model` | The model to use | No | `gpt-4o-mini` |
| `break-build` | Optionally fail the build to enforce changelog updates | No | false |
| `changelog-path` | Path to the CHANGELOG file | No | `CHANGELOG.md` |

## Development

### Building

```bash
npm install
npm run build
```

### Testing

```bash
npm test
```

### Local Development

```bash
npm run dev
```

## License

BSD
