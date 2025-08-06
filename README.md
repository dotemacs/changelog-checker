# Changelog Checker GitHub Action

A GitHub Action that automatically checks if a PR includes updates to
`CHANGELOG.md` and suggests appropriate changelog entries using GitHub
Models if the updates are missing.

## Features

- Automatically detects if `CHANGELOG.md` was modified in a PR
- Analyzes PR content including commits, descriptions, and code changes
- Uses GitHub Models API for intelligent changelog generation
- Creates PR comments with suggested changelog updates
- Follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format
- Free for open source projects using GitHub Models

## Setup

### 1. Add the Action to Your Workflow

Create `.github/workflows/changelog-check.yml` below and **thats it**!

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
        uses: dotemacs/changelog-checker@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          model: 'gpt-4o-mini'
```

### 2. GitHub Models Access

**NOTE:** you **don't** have to generate the GitHub token, this is
done automatically during the run.

GitHub Models is available for open source projects. The action uses the built-in `GITHUB_TOKEN` with `models:read` permission to access the API. Learn more in [GitHub's announcement](https://github.blog/ai-and-ml/llms/solving-the-inference-problem-for-open-source-ai-projects-with-github-models/).

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token with models:read permission | Yes | - |
| `model` | The model to use | No | `gpt-4o-mini` |

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

## Changelog Categories

The action uses standard [Keep a Changelog](https://keepachangelog.com/) categories:

- **Added** - for new features
- **Changed** - for changes in existing functionality
- **Deprecated** - for features that will be removed
- **Removed** - for removed features
- **Fixed** - for bug fixes
- **Security** - for security-related changes

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
