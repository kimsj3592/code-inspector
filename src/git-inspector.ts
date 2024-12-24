import { spawn } from 'child_process';
import { Readable } from 'stream';
import * as readline from 'readline';

const MAX_CONCURRENT_BRANCHES = 10;
const TWO_YEARS_AGO = new Date(
  new Date().setFullYear(new Date().getFullYear() - 2),
);

const excludeExtensions = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.mp3',
  '.wav',
  '.ogg',
  '.flac',
  '.aac',
  '.m4a',
  '.mp4',
  '.mkv',
  '.avi',
  '.mov',
  '.flv',
  '.wmv',
  '.webm',
  '.zip',
  '.pdf',
  '.bin',
  '.rlp',
  '.dat',
  '.dll',
  '.pxm',
  '.icns',
  '.node',
];

function isBinaryFile(content: Buffer): boolean {
  return content.some((byte) => byte <= 8 || (byte >= 14 && byte <= 31));
}

function executeGitCommand(args: string[], cwd: string): Readable {
  const gitProcess = spawn('git', args, { cwd });
  return gitProcess.stdout;
}

export async function inspectGitHistory(
  targetPath: string,
  filterOldBranches = true,
) {
  console.log(`\n🔍 Inspecting Git history in: ${targetPath}\n`);

  const branchListStream = executeGitCommand(
    ['ls-remote', '--heads'],
    targetPath,
  );

  const branchNames = await parseBranchList(branchListStream);
  console.log(`📂 Total branches found: ${branchNames.length}`);

  const branchesToInspect = filterOldBranches
    ? await filterActiveBranches(targetPath, branchNames)
    : branchNames;

  console.log(
    `📂 Branches selected for inspection: ${branchesToInspect.length}`,
  );

  const results: { branch: string; commit: string; file: string }[] = [];

  for (let i = 0; i < branchesToInspect.length; i += MAX_CONCURRENT_BRANCHES) {
    const batch = branchesToInspect.slice(i, i + MAX_CONCURRENT_BRANCHES);
    console.log(
      `\n🚀 Processing batch ${Math.ceil(i / MAX_CONCURRENT_BRANCHES)}`,
    );

    await Promise.all(
      batch.map(async (branch) => {
        try {
          console.log(`🔍 Processing branch: ${branch}`);
          const branchResults = await processBranchWithStream(
            targetPath,
            branch,
          );
          results.push(...branchResults);
        } catch (err) {
          console.error(
            `❌ Error processing branch ${branch}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }),
    );
  }

  printFinalResults(results);
  return results;
}

async function parseBranchList(branchListStream: Readable): Promise<string[]> {
  const rl = readline.createInterface({ input: branchListStream });
  const branches: string[] = [];

  for await (const line of rl) {
    const match = line.split('\t')[1]?.replace('refs/heads/', '').trim();
    if (match) branches.push(match);
  }

  return branches;
}

async function filterActiveBranches(
  targetPath: string,
  branchNames: string[],
): Promise<string[]> {
  const activeBranches: string[] = [];
  await Promise.all(
    branchNames.map(async (branch) => {
      try {
        const logStream = executeGitCommand(
          ['log', '-1', '--format=%ci', `origin/${branch}`],
          targetPath,
        );

        const lastCommitDate = await parseLastCommitDate(logStream);
        if (lastCommitDate > TWO_YEARS_AGO) {
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

async function parseLastCommitDate(logStream: Readable): Promise<Date> {
  const rl = readline.createInterface({ input: logStream });

  const line = await new Promise<string | undefined>((resolve) => {
    rl.once('line', resolve);
    rl.once('close', () => resolve(undefined));
  });
  if (line) {
    return new Date(line.trim());
  }

  throw new Error('No commit date found.');
}

async function processBranchWithStream(targetPath: string, branch: string) {
  const results: { branch: string; commit: string; file: string }[] = [];
  const diffStream = executeGitCommand(
    ['log', '-p', `origin/${branch}`, '--since=2.years', '--pretty=format:%H'],
    targetPath,
  );

  const parsedResults = await processGitDiffStream(diffStream, branch);
  results.push(...parsedResults);

  return results;
}

async function processGitDiffStream(diffStream: Readable, branch: string) {
  const rl = readline.createInterface({ input: diffStream });

  const fileRegex = /^diff --git a\/(.+?) b\/(.+?)$/;

  let currentCommit: string | null = null;
  let currentFile: string | null = null;
  const results: { branch: string; commit: string; file: string }[] = [];

  for await (const line of rl) {
    if (/^[a-f0-9]{40}$/.test(line)) {
      currentCommit = line.trim();
      continue;
    }

    const fileMatch = line.match(fileRegex);
    if (fileMatch) {
      currentFile = fileMatch[2];

      if (excludeExtensions.some((ext) => currentFile?.endsWith(ext))) {
        currentFile = null;
      }
      continue;
    }

    if (currentFile && line.startsWith('+')) {
      const content = line.slice(1).trim();

      if (isBinaryFile(Buffer.from(content, 'utf8'))) {
        currentFile = null;
        continue;
      }

      if (containsNonEnglish(content)) {
        results.push({
          branch,
          commit: currentCommit!.slice(0, 7),
          file: currentFile,
        });
        currentFile = null;
      }
    }
  }

  return results;
}

function containsNonEnglish(content: string): boolean {
  const nonEnglishRegex = /[\u4E00-\u9FFF\uAC00-\uD7AF]+/;
  return nonEnglishRegex.test(content);
}

function printFinalResults(
  results: { branch: string; commit: string; file: string }[],
) {
  if (results.length === 0) {
    console.log('\n✅ No non-English content found.');
    return;
  }

  console.log('\n🔍 Final Results:');
  const groupedResults: Record<string, Record<string, Set<string>>> = {};

  results.forEach(({ branch, commit, file }) => {
    if (!groupedResults[branch]) groupedResults[branch] = {};
    if (!groupedResults[branch][commit])
      groupedResults[branch][commit] = new Set();
    groupedResults[branch][commit].add(file);
  });

  for (const [branch, commits] of Object.entries(groupedResults)) {
    console.log(`\n🔍 Branch: ${branch}`);
    for (const [commit, files] of Object.entries(commits)) {
      console.log(`  📝 Commit: ${commit}`);
      console.log(`  📄 Files: ${Array.from(files).join(', ')}`);
    }
  }
}
