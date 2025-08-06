import * as core from '@actions/core';
import * as github from '@actions/github';
import { analyzeChanges } from './analyzer';
import { generateChangelogEntry } from './llm';
import { createPRSuggestion } from './pr-handler';

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const model = core.getInput('model') || 'gpt-4o-mini';

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

    core.info(`Checking PR #${pr.number} for CHANGELOG.md updates...`);

    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
    });

    const changelogModified = files.some(file => 
      file.filename === 'CHANGELOG.md' || file.filename.endsWith('/CHANGELOG.md')
    );

    if (changelogModified) {
      core.info('CHANGELOG.md has been modified in this PR. No action needed.');
      return;
    }

    core.info('CHANGELOG.md not modified. Analyzing PR changes...');

    const analysis = await analyzeChanges(octokit, context, pr);
    
    core.info('Generating changelog entry suggestion...');
    const changelogEntry = await generateChangelogEntry(analysis, token, model);
    
    core.info('Creating PR suggestion...');
    await createPRSuggestion(octokit, context, pr, changelogEntry);
    
    core.info('Successfully created changelog suggestion!');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();