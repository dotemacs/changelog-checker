import * as core from '@actions/core';
import * as github from '@actions/github';
import { analyzeChanges } from './analyzer';
import { generateChangelogEntry } from './llm';
import { createPRSuggestion } from './pr-handler';

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const model = core.getInput('model') || 'gpt-4o-mini';
    const breakBuild = core.getInput('break-build') === 'true';
    const changelogPath = core.getInput('changelog-path') || 'CHANGELOG.md';

    const octokit = github.getOctokit(token);
    const context = github.context;

    if (context.eventName !== 'pull_request') {
      core.setFailed('This action only works on pull_request events');
      return;
    }

    const pr = context.payload.pull_request;
    if (!pr) {
      core.setFailed('Could not get pull request from context');
      return;
    }

    core.info(`Checking PR #${pr.number} for ${changelogPath} updates...`);

    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
    });

    const changelogModified = files.some(file => {
      // Normalize paths for comparison
      const normalizedChangelog = changelogPath.startsWith('/') ? changelogPath.slice(1) : changelogPath;
      const normalizedFilename = file.filename.startsWith('/') ? file.filename.slice(1) : file.filename;
      return normalizedFilename === normalizedChangelog;
    });

    if (changelogModified) {
      core.info(`${changelogPath} has been modified in this PR. No action needed.`);
      return;
    }

    core.info(`${changelogPath} not modified. Analyzing PR changes...`);

    const analysis = await analyzeChanges(octokit, context, pr);
    
    core.info('Generating changelog entry suggestion...');
    const changelogEntry = await generateChangelogEntry(analysis, token, model);
    
    core.info('Creating PR suggestion...');
    await createPRSuggestion(octokit, context, pr, changelogEntry, changelogPath);
    
    if (breakBuild) {
      core.setFailed(`${changelogPath} needs to be updated. See PR comment for suggestions.`);
    } else {
      core.info('Successfully created changelog suggestion!');
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();