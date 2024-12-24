import { spawn } from 'child_process';
import * as fastGlob from 'fast-glob';
import * as fs from 'fs-extra';
import * as readline from 'readline';

const EXCLUDED_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.svg',
  '**/*.webp',
  '**/*.mp3',
  '**/*.wav',
  '**/*.ogg',
  '**/*.flac',
  '**/*.aac',
  '**/*.m4a',
  '**/*.mp4',
  '**/*.mkv',
  '**/*.avi',
  '**/*.mov',
  '**/*.flv',
  '**/*.wmv',
  '**/*.webm',
  '**/*.zip',
  '**/*.pdf',
  '**/*.bin',
  '**/*.rlp',
  '**/*.dat',
  '**/*.dll',
  '**/*.json',
  '**/*.lock',
  '**/*.log',
  '**/*.txt',
  '**/*.csv',
  '**/*.ico',
  '**/*.node',
];

const TWO_YEARS_AGO = new Date(
  new Date().setFullYear(new Date().getFullYear() - 2),
);

async function executeGitCommand(
  args: string[],
  cwd: string,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const gitProcess = spawn('git', args, { cwd });
    let output = '';
    gitProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    gitProcess.stderr.on('data', (data) => {
      console.error(`Git error: ${data}`);
    });
    gitProcess.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(`Git command failed with code ${code}: ${args.join(' ')}`),
        );
      } else {
        resolve(output.split('\n').filter((line) => line.trim() !== ''));
      }
    });
    gitProcess.on('error', reject);
  });
}

async function parseLastCommitDate(logStream: string[]): Promise<Date> {
  if (logStream.length === 0) {
    throw new Error('No commit date found.');
  }
  return new Date(logStream[0].trim());
}

async function filterActiveBranches(
  targetPath: string,
  branchNames: string[],
): Promise<string[]> {
  const activeBranches: string[] = [];
  await Promise.all(
    branchNames.map(async (branch) => {
      try {
        const logStream = await executeGitCommand(
          ['log', '-1', '--format=%ci', `origin/${branch}`],
          targetPath,
        );
        const lastCommitDate = await parseLastCommitDate(logStream);
        if (lastCommitDate > TWO_YEARS_AGO) {
          activeBranches.push(branch);
        }
      } catch (err) {
        console.warn(
          `⚠️ Could not determine last commit date for ${branch}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );
  return activeBranches;
}

function isBinaryFile(content: Buffer): boolean {
  return content.some((byte) => byte <= 8 || (byte >= 14 && byte <= 31));
}

export async function inspectFiles(
  targetPath: string,
  isLocalPath: boolean,
  filterOldBranches = true,
): Promise<Record<string, number[]>> {
  const results: Record<string, number[]> = {};

  if (isLocalPath) {
    console.log(`\n🔍 Inspecting local path: ${targetPath}`);

    try {
      const files: string[] = [];
      for await (const file of fastGlob.stream(`${targetPath}/**/*`, {
        dot: true,
        onlyFiles: true,
        ignore: EXCLUDED_PATTERNS,
      })) {
        files.push(file.toString());
      }

      await Promise.all(
        files.map(async (filePath) => {
          try {
            const content = await fs.readFile(filePath);
            if (isBinaryFile(content)) {
              console.log(`⚠️ Skipping binary file: ${filePath}`);
              return;
            }

            await inspectFileWithStream(filePath, results);
          } catch (err) {
            console.error(
              `❌ Error reading file: ${filePath}`,
              err instanceof Error ? err.message : err,
            );
          }
        }),
      );

      printResults(results);
    } catch (err) {
      console.error(
        `❌ Error inspecting local path:`,
        err instanceof Error ? err.message : err,
      );
    }
  } else {
    console.log(`\n🔍 Inspecting repository branches in: ${targetPath}`);

    const branchList = await executeGitCommand(
      ['ls-remote', '--heads'],
      targetPath,
    );
    const branchNames = branchList.map((line) =>
      line.split('\t')[1].replace('refs/heads/', '').trim(),
    );

    console.log(`📂 Total branches found: ${branchNames.length}`);

    const activeBranches = filterOldBranches
      ? await filterActiveBranches(targetPath, branchNames)
      : branchNames;

    console.log(`📂 Active branches to process: ${activeBranches.length}`);

    await Promise.all(
      activeBranches.map(async (branch) => {
        console.log(`🔍 Processing branch: ${branch}`);
        const branchResults = await inspectBranchFiles(targetPath, branch);
        Object.assign(results, branchResults);
      }),
    );

    printResults(results);
  }

  return results;
}

async function inspectBranchFiles(
  targetPath: string,
  branch: string,
): Promise<Record<string, number[]>> {
  const results: Record<string, number[]> = {};

  try {
    console.log(`🔍 Checking out branch: ${branch}`);
    await executeGitCommand(['reset', '--hard'], targetPath);
    await executeGitCommand(['clean', '-fd'], targetPath);
    await executeGitCommand(['checkout', branch], targetPath);

    console.log(`✅ Successfully checked out branch: ${branch}`);

    const files: string[] = [];
    for await (const file of fastGlob.stream(`${targetPath}/**/*`, {
      dot: true,
      onlyFiles: true,
      ignore: EXCLUDED_PATTERNS,
    })) {
      files.push(file.toString());
    }

    await Promise.all(
      files.map(async (filePath) => {
        try {
          const content = await fs.readFile(filePath);
          if (isBinaryFile(content)) {
            console.log(`⚠️ Skipping binary file: ${filePath}`);
            return;
          }

          await inspectFileWithStream(filePath, results);
        } catch (err) {
          console.error(
            `❌ Error reading file: ${filePath}`,
            err instanceof Error ? err.message : err,
          );
        }
      }),
    );
  } catch (err) {
    console.error(
      `❌ Error processing branch ${branch}:`,
      err instanceof Error ? err.message : err,
    );
  }

  return results;
}

async function inspectFileWithStream(
  filePath: string,
  results: Record<string, number[]>,
): Promise<void> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    if (containsNonEnglish(line)) {
      if (!results[filePath]) {
        results[filePath] = [];
      }
      results[filePath].push(lineNumber);
    }
  }
}

function containsNonEnglish(content: string): boolean {
  const nonEnglishRegex = /[\u4E00-\u9FFF\uAC00-\uD7AF]+/;
  return nonEnglishRegex.test(content);
}

function printResults(
  results: Record<string, number[]>,
  branch?: string,
): void {
  if (branch) {
    console.log(`\n🔍 Results for branch: ${branch}`);
  } else {
    console.log(`\n🔍 Inspection results:`);
  }

  if (Object.keys(results).length === 0) {
    console.log('✅ No non-English content found!');
    return;
  }

  for (const [file, lines] of Object.entries(results)) {
    console.log(`📄 File: ${file}`);
    console.log(`   Total Issues: ${lines.length}`);
    console.log(`   Lines: ${groupConsecutiveLines(lines)}`);
  }
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
