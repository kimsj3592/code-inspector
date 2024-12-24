import axios from 'axios';
import { inspectFiles } from './file-inspector';
import { inspectGitHistory } from './git-inspector';
import simpleGit from 'simple-git';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as process from 'node:process';

const ACCESS_TOKEN: string = process.env.GITLAB_ACCESS_TOKEN!;
const BASE_URL: string = process.env.GITLAB_BASE_URL!;
const START_GROUP_ID: string = process.env.GITLAB_START_GROUP_ID!;
const MAX_CONCURRENT_PROJECTS = 10;

const urls: string[] = [];
const failedProjects: any[] = [];

async function fetchAllProjectUrls(groupId: string) {
  const queue: string[] = [groupId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentGroupId = queue.shift();
    if (!currentGroupId || visited.has(currentGroupId)) continue;
    visited.add(currentGroupId);

    try {
      const subGroups = await axios.get(
        `${BASE_URL}/groups/${currentGroupId}/subgroups`,
        { headers: { 'PRIVATE-TOKEN': ACCESS_TOKEN } },
      );
      subGroups.data.forEach((group: any) => queue.push(group.id));

      const projects = await axios.get(
        `${BASE_URL}/groups/${currentGroupId}/projects`,
        {
          headers: { 'PRIVATE-TOKEN': ACCESS_TOKEN },
          params: { include_subgroups: false, per_page: 100 },
        },
      );
      projects.data.forEach((project: any) => {
        if (project.ssh_url_to_repo) {
          urls.push(project.ssh_url_to_repo);
        }
      });
    } catch (error) {
      console.error(
        `❌ Error fetching group ${currentGroupId}:`,
        error.message,
      );
    }
  }

  console.log(`✅ Total Projects Found: ${urls.length}`);
}

function groupConsecutiveLines(lines: number[]): string {
  const ranges: string[] = [];
  let start = lines[0];
  let end = lines[0];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === end + 1) {
      end = lines[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = end = lines[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(', ');
}

function formatGitInspect(
  gitHistoryResults: { branch: string; commit: string; file: string }[],
): Record<string, Record<string, string[]>> {
  const result: Record<string, Record<string, string[]>> = {};
  gitHistoryResults.forEach(({ branch, commit, file }) => {
    if (!result[branch]) result[branch] = {};
    if (!result[branch][commit]) result[branch][commit] = [];
    result[branch][commit].push(path.basename(file));
  });
  return result;
}

function formatFileInspect(
  fileResults: Record<string, { file: string; lines: number[] }[]>,
): Record<string, { file: string; lines: string }[]> {
  const result: Record<string, { file: string; lines: string }[]> = {};
  for (const [branch, files] of Object.entries(fileResults)) {
    const filteredFiles = files
      .map(({ file, lines }) => ({
        file: path.basename(file),
        lines: groupConsecutiveLines(lines),
      }))
      .filter(({ lines }) => lines.length > 0);

    if (filteredFiles.length > 0) {
      result[branch] = filteredFiles;
    }
  }
  return result;
}

async function inspectFilesForAllBranches(
  targetPath: string,
  filterOldBranches: boolean = true,
): Promise<Record<string, { file: string; lines: number[] }[]>> {
  const branchList = await simpleGit(targetPath).branch(['-r']);
  const branchNames = branchList.all.map((branch) =>
    branch.replace('origin/', ''),
  );

  console.log(`📂 Total branches found: ${branchNames.length}`);

  let branchesToInspect = branchNames;

  if (filterOldBranches) {
    // Filter branches updated within the last 2 years
    branchesToInspect = await filterActiveBranches(targetPath, branchNames);
    console.log(
      `📂 Active branches (updated within 2 years): ${branchesToInspect.length}`,
    );
  }

  const branchResults: Record<string, { file: string; lines: number[] }[]> = {};

  for (const branch of branchesToInspect) {
    console.log(`🔍 Checking out branch: ${branch}`);
    await simpleGit(targetPath).checkout(branch);

    const fileResults = await inspectFiles(targetPath, true);
    const filteredResults = Object.entries(fileResults)
      .map(([file, lines]) => ({
        file,
        lines,
      }))
      .filter(({ lines }) => lines.length > 0);

    if (filteredResults.length > 0) {
      branchResults[branch] = filteredResults;
    }
  }

  return branchResults;
}

async function inspectSingleProject(url: string, filterOldBranches: boolean) {
  const projectName =
    url.split('/').pop()?.replace('.git', '') || 'unknown-project';
  const targetPath = path.join(process.cwd(), `temp-clone-${projectName}`);

  try {
    console.log(`\n🔗 Cloning project: ${projectName}`);
    if (fs.existsSync(targetPath)) await fs.remove(targetPath);
    await simpleGit().clone(url, targetPath);

    console.log(`🔍 Inspecting files and git history for: ${projectName}`);

    const [fileResultsForBranches, gitHistoryResults] = await Promise.all([
      inspectFilesForAllBranches(targetPath, filterOldBranches),
      inspectGitHistory(targetPath, filterOldBranches),
    ]);

    return {
      projectName,
      url,
      gitInspect: formatGitInspect(gitHistoryResults),
      fileInspect: formatFileInspect(fileResultsForBranches),
    };
  } catch (err) {
    console.error(`❌ Failed to inspect ${projectName}: ${err.message}`);
    failedProjects.push({ projectName, url, error: err.message });
    return null;
  } finally {
    if (fs.existsSync(targetPath)) await fs.remove(targetPath);
  }
}

async function saveResultsToFile(results: any[], batchIndex: number) {
  const outputPath = path.join(
    process.cwd(),
    `inspection-results-batch-${batchIndex + 1}.json`,
  );
  try {
    await fs.writeJson(outputPath, results, { spaces: 2 });
    console.log(`📄 Results saved to: ${outputPath}`);
  } catch (err) {
    console.error(`❌ Error saving results to file: ${err.message}`);
  }
}

export async function inspectProjects(filterOldBranches: boolean = true) {
  console.log('🔍 Fetching all project URLs...');
  await fetchAllProjectUrls(START_GROUP_ID);

  console.log(`✅ Total Projects Found: ${urls.length}`);

  for (let i = 0; i < urls.length; i += MAX_CONCURRENT_PROJECTS) {
    const batch = urls.slice(i, i + MAX_CONCURRENT_PROJECTS);
    console.log(
      `\n🚀 Processing batch ${Math.floor(i / MAX_CONCURRENT_PROJECTS) + 1}`,
    );

    const results = await Promise.all(
      batch.map((url) => inspectSingleProject(url, filterOldBranches)),
    );

    const successfulResults = results.filter((result) => result !== null);
    await saveResultsToFile(
      successfulResults,
      Math.floor(i / MAX_CONCURRENT_PROJECTS),
    );
  }

  if (failedProjects.length > 0) {
    const errorLogPath = path.join(process.cwd(), 'failed-projects.json');
    await fs.writeJson(errorLogPath, failedProjects, { spaces: 2 });
    console.log(`⚠️ Error log saved to: ${errorLogPath}`);
  }

  console.log('🔍 All inspections complete!');
}

async function filterActiveBranches(
  targetPath: string,
  branchNames: string[],
): Promise<string[]> {
  const TWO_YEARS_AGO = new Date(
    new Date().setFullYear(new Date().getFullYear() - 2),
  );

  const activeBranches: string[] = [];
  await Promise.all(
    branchNames.map(async (branch) => {
      try {
        const logStream = await simpleGit(targetPath).log([
          '--since',
          TWO_YEARS_AGO.toISOString(),
          `origin/${branch}`,
        ]);

        if (logStream.total > 0) {
          activeBranches.push(branch);
        }
      } catch (err) {
        console.warn(
          `⚠️ Could not determine last commit date for ${branch}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }),
  );
  return activeBranches;
}
