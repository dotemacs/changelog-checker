import { GitHub } from '@actions/github/lib/utils';
import { Context } from '@actions/github/lib/context';
import { ChangelogEntry } from './llm';
import * as core from '@actions/core';

export async function createPRSuggestion(
  octokit: InstanceType<typeof GitHub>,
  context: Context,
  pr: any,
  entry: ChangelogEntry
): Promise<void> {
  try {
    const { data: changelog } = await octokit.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: 'CHANGELOG.md',
      ref: pr.base.ref,
    }).catch(() => {
      return { data: null };
    });

    let currentContent = '';
    if (changelog && 'content' in changelog) {
      currentContent = Buffer.from(changelog.content, 'base64').toString('utf-8');
    }

    const changelogExists = currentContent !== '';
    const updatedContent = generateUpdatedChangelog(currentContent, entry);
    const suggestion = changelogExists
      ? createSuggestionComment(entry, updatedContent)
      : createMissingChangelogComment(entry, updatedContent);

    const { data: comments } = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pr.number,
    });

    const botComment = comments.find(comment =>
      comment.user?.type === 'Bot' &&
      comment.body?.includes('## Changelog Suggestion')
    );

    if (botComment) {
      core.info('Updating existing changelog suggestion comment...');
      await octokit.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: botComment.id,
        body: suggestion,
      });
    } else {
      core.info('Creating new changelog suggestion comment...');
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: pr.number,
        body: suggestion,
      });
    }

    // Try to create a mergeable file suggestion
    if (!changelogExists) {
      // If CHANGELOG.md doesn't exist, create it as a new file suggestion
      core.info('CHANGELOG.md does not exist, creating file creation suggestion...');

      // Create a branch from the PR head
      const branchName = `changelog-suggestion-${pr.number}`;

      try {
        // Get the PR head SHA
        const { data: prData } = await octokit.rest.pulls.get({
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: pr.number,
        });

        // Create a new file in the PR's branch
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: context.repo.owner,
          repo: context.repo.repo,
          path: 'CHANGELOG.md',
          message: `Add CHANGELOG.md with entry for PR #${pr.number}`,
          content: Buffer.from(updatedContent).toString('base64'),
          branch: prData.head.ref,
        }).then(() => {
          core.info('Successfully created CHANGELOG.md file suggestion in PR branch');
        }).catch((error) => {
          core.warning(`Could not create file in PR branch: ${error.message}`);
        });
      } catch (error) {
        core.warning(`Could not create mergeable suggestion: ${error}`);
      }
    } else {
      // If CHANGELOG.md exists, try to create an inline suggestion
      core.info('Creating inline suggestion for existing CHANGELOG.md...');

        // Get the current file from the PR branch
        const { data: prFile } = await octokit.rest.repos.getContent({
            owner: context.repo.owner,
            repo: context.repo.repo,
            path: 'CHANGELOG.md',
            ref: pr.head.ref,
        }).catch(() => ({ data: null }));

        if (prFile && 'content' in prFile) {
            const prContent = Buffer.from(prFile.content, 'base64').toString('utf-8');
            const updatedPrContent = generateUpdatedChangelog(prContent, entry);

            // Create or update the file in the PR branch
            await octokit.rest.repos.createOrUpdateFileContents({
                owner: context.repo.owner,
                repo: context.repo.repo,
                path: 'CHANGELOG.md',
                message: `Update CHANGELOG.md for PR #${pr.number}`,
                content: Buffer.from(updatedPrContent).toString('base64'),
                sha: prFile.sha,
                branch: pr.head.ref,
            }).then(() => {
                core.info('Successfully updated CHANGELOG.md in PR branch');
            }).catch((error) => {
                core.warning(`Could not update file in PR branch: ${error.message}`);
            });
        }
    }

  } catch (error) {
    core.error(`Error creating PR suggestion: ${error}`);
    throw error;
  }
}

function generateUpdatedChangelog(currentContent: string, entry: ChangelogEntry): string {
  if (!currentContent) {
    return createNewChangelog(entry);
  }

  const lines = currentContent.split('\n');
  const unreleasedIndex = lines.findIndex(line =>
      line.match(/^##\s+\[?Unreleased\]?/i)
  );

  if (unreleasedIndex === -1) {
    const firstVersionIndex = lines.findIndex(line =>
        line.match(/^##\s+\[?\d+\.\d+\.\d+/)
    );

    if (firstVersionIndex === -1) {
      lines.push('');
      lines.push('## [Unreleased]');
      lines.push('');
      lines.push(`### ${entry.category}`);
      lines.push(`- ${entry.description}`);
    } else {
      lines.splice(firstVersionIndex, 0,
                   '## [Unreleased]',
                   '',
                   `### ${entry.category}`,
                   `- ${entry.description}`,
                   ''
      );
    }
  } else {
    let categoryIndex = -1;
    for (let i = unreleasedIndex + 1; i < lines.length; i++) {
      if (lines[i].match(/^##\s+\[?\d+\.\d+\.\d+/)) {
        break;
      }
      if (lines[i].includes(`### ${entry.category}`)) {
        categoryIndex = i;
        break;
      }
    }

    if (categoryIndex === -1) {
      let insertIndex = unreleasedIndex + 1;
      while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
        insertIndex++;
      }

        lines.splice(insertIndex, 0, '', `### ${entry.category}`, `- ${entry.description}`);
    } else {
      let insertIndex = categoryIndex + 1;
      while (insertIndex < lines.length &&
          !lines[insertIndex].startsWith('###') &&
          !lines[insertIndex].match(/^##\s+/)) {
        if (lines[insertIndex].trim() === '') {
          break;
        }
        insertIndex++;
      }
      lines.splice(insertIndex, 0, `- ${entry.description}`);
    }
  }

  return lines.join('\n');
}

function createNewChangelog(entry: ChangelogEntry): string {
  return `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ${entry.category}
- ${entry.description}
`;
}

function createSuggestionComment(entry: ChangelogEntry, updatedContent: string): string {
  return `## 📝 Changelog Suggestion

This PR does not include updates to \`CHANGELOG.md\`. Based on the changes, here's a suggested entry:

**Category:** \`${entry.category}\`
**Description:** ${entry.description}

### Suggested CHANGELOG.md entry:

\`\`\`markdown
### ${entry.category}
- ${entry.description}
\`\`\`

<details>
<summary>Click to see the full updated CHANGELOG.md</summary>

\`\`\`markdown
${updatedContent}
\`\`\`

</details>

---
*This suggestion was automatically generated. You can apply it directly in GitHub's UI or update your CHANGELOG.md manually.*`;
}

function createInlineSuggestion(entry: ChangelogEntry): string {
  return `\`\`\`suggestion
### ${entry.category}
- ${entry.description}
\`\`\``;
}

function createMissingChangelogComment(entry: ChangelogEntry, fullContent: string): string {
  return `## Missing CHANGELOG.md

This repository does not have a CHANGELOG.md file. It's recommended to create one to track changes over time.

### Suggested CHANGELOG.md to create:

\`\`\`markdown
${fullContent}
\`\`\`

### Quick add:

The action has attempted to create this file in your PR branch. Check the "Files changed" tab to review and commit it.

---
*This suggestion follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.*`;
}

function createReviewSuggestion(entry: ChangelogEntry): string {
  return `## Suggested CHANGELOG.md Update

Add the following entry to your CHANGELOG.md file under the [Unreleased] section:

\`\`\`markdown
### ${entry.category}
- ${entry.description}
\`\`\``;
}
