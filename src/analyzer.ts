import { GitHub } from '@actions/github/lib/utils';
import { Context } from '@actions/github/lib/context';

export interface PRAnalysis {
  title: string;
  description: string;
  commits: Array<{
    message: string;
    sha: string;
  }>;
  filesChanged: Array<{
    filename: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
  diffSummary: string;
}

export async function analyzeChanges(
  octokit: InstanceType<typeof GitHub>,
  context: Context,
  pr: any
): Promise<PRAnalysis> {
  const { data: commits } = await octokit.rest.pulls.listCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pr.number,
  });

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pr.number,
  });

  const commitMessages = commits.map(commit => ({
    message: commit.commit.message,
    sha: commit.sha,
  }));

  const filesChanged = files.map(file => ({
    filename: file.filename,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch,
  }));

  const diffSummary = createDiffSummary(filesChanged);

  return {
    title: pr.title,
    description: pr.body || '',
    commits: commitMessages,
    filesChanged,
    diffSummary,
  };
}

function createDiffSummary(files: PRAnalysis['filesChanged']): string {
  const summary: string[] = [];
  
  const filesByExtension = new Map<string, number>();
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const file of files) {
    const ext = file.filename.split('.').pop() || 'other';
    filesByExtension.set(ext, (filesByExtension.get(ext) || 0) + 1);
    totalAdditions += file.additions;
    totalDeletions += file.deletions;
  }

  summary.push(`Files changed: ${files.length}`);
  summary.push(`Lines added: ${totalAdditions}`);
  summary.push(`Lines deleted: ${totalDeletions}`);
  
  if (filesByExtension.size > 0) {
    const types = Array.from(filesByExtension.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ext, count]) => `${ext} (${count})`)
      .join(', ');
    summary.push(`Main file types: ${types}`);
  }

  const significantFiles = files
    .filter(f => f.additions + f.deletions > 50)
    .slice(0, 5)
    .map(f => f.filename);
  
  if (significantFiles.length > 0) {
    summary.push(`Significant changes in: ${significantFiles.join(', ')}`);
  }

  return summary.join('\n');
}