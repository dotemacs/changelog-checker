import OpenAI from 'openai';
import { PRAnalysis } from './analyzer';
import * as core from '@actions/core';

const SYSTEM_PROMPT = `You are a technical writer helping maintain a CHANGELOG.md file following the Keep a Changelog format (https://keepachangelog.com/en/1.1.0/). Your task is to analyze a pull request and generate an appropriate changelog entry.

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
- If multiple categories apply, choose the most significant one`;

export interface ChangelogEntry {
  category: 'Added' | 'Changed' | 'Deprecated' | 'Removed' | 'Fixed' | 'Security';
  description: string;
}

export async function generateChangelogEntry(
  analysis: PRAnalysis,
  githubToken: string,
  model: string
): Promise<ChangelogEntry> {
  const openai = new OpenAI({
    apiKey: githubToken,
    baseURL: 'https://models.github.ai/inference',
  });

  const userPrompt = createUserPrompt(analysis);

  core.debug(`Sending request to model: ${model}`);
  core.debug(`User prompt: ${userPrompt}`);

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    core.debug(`LLM response: ${content}`);

    const parsed = JSON.parse(content) as ChangelogEntry;

    if (!isValidCategory(parsed.category)) {
      throw new Error(`Invalid category returned: ${parsed.category}`);
    }

    if (!parsed.description || parsed.description.trim().length === 0) {
      throw new Error('Empty description returned');
    }

    return parsed;
  } catch (error) {
    core.error(`Error generating changelog entry: ${error}`);

    return {
      category: 'Changed',
      description: analysis.title || 'Updated project functionality'
    };
  }
}

function createUserPrompt(analysis: PRAnalysis): string {
  const parts: string[] = [];

  parts.push(`Pull Request Title: ${analysis.title}`);

  if (analysis.description) {
    parts.push(`\nPull Request Description:\n${analysis.description}`);
  }

  if (analysis.commits.length > 0) {
    parts.push(`\nCommit Messages:`);
    for (const commit of analysis.commits.slice(0, 10)) {
      parts.push(`- ${commit.message.split('\n')[0]}`);
    }
  }

  parts.push(`\nChange Summary:\n${analysis.diffSummary}`);

    if (analysis.filesChanged.length > 0) {
        const significantFiles = analysis.filesChanged
            .filter(f => f.additions + f.deletions > 20)
            .slice(0, 10);

        if (significantFiles.length > 0) {
            parts.push(`\nKey Files Modified:`);
            for (const file of significantFiles) {
                parts.push(`- ${file.filename} (+${file.additions}/-${file.deletions})`);
            }
        }
    }

    parts.push(`\nBased on this pull request, generate an appropriate changelog entry.`);

    return parts.join('\n');
}

function isValidCategory(category: string): category is ChangelogEntry['category'] {
  return ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'].includes(category);
}
