# Plan

## The summary

Create GitHub action that checks if the PR create has touched
CHANGELOG.md, if it hasn't it should look at the commits in the PR and
their descriptions as well as code changes and create a suggestion for
the PR that can be merged in GitHub's UI, by clicking on a button.

The format of the CHANGELOG.md should be in the format as described
in: https://keepachangelog.com/en/1.1.0/

Try to create an update to CHANGELOG.md if it exists, if it doesn't
exist, create a comment stating that CHANGELOG.md should be created
and then add a comment in the PR showing what should be added to
CHANGELOG.md.

## Constraints

### Language

The GitHub action should be written in TypeScript.

The action should use GitHub LLM models as per this blog post:

https://github.blog/ai-and-ml/llms/solving-the-inference-problem-for-open-source-ai-projects-with-github-models/

### API

Use the GitHub endpoint instead of Azure one.

### Prompt

The system prompt should be defined as:

`You are a technical writer helping maintain a CHANGELOG.md file following the Keep a Changelog format (https://keepachangelog.com/en/1.1.0/). Your task is to analyze a pull request and generate an appropriate changelog entry.

The Keep a Changelog categories are:
- Added: for new features
- Changed: for changes in existing functionality
- Deprecated: for features that will be removed
- Removed: for removed features
- Fixed: for bug fixes
- Security: for security-related changes

Your response must be in this exact JSON format:
{
"category": "one of: Added, Changed, Deprecated, Removed, Fixed, Security",
"description": "a concise, user-focused description of the change (without leading dash or PR number)"
}

Guidelines:
- Focus on user-facing impact, not implementation details
- Be concise but informative
- Use present tense
- Don't include PR numbers or technical jargon unless necessary
- If multiple categories apply, choose the most significant one`

## Options

### break-build

Add an option `break-build: true|false`, with default setting being
false, that can be added in the configuration:

```
      - name: Check and Suggest Changelog
        uses: dotemacs/changelog-llm@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          model: 'gpt-4o-mini'
          break-build: true
```

Which will output the message in the PR comment, but will not exit the
run as success. Instead it should return a failed state, thus
informing the user that they need to amend/update/create CHANGELOG.md
in order for the job to pass.

### changelog-path

Add an option `changelog-path` which by default should point to
CHANGELOG.md in the root of the repo.

Potential configuration example:
  - uses: dotemacs/changelog-llm@main
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      changelog-path: 'docs/CHANGELOG.md'  # or 'HISTORY.md' or 'packages/*/CHANGELOG.md'
