import simpleGit from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';

export async function inspectGitHistory(targetPath: string) {
  const git = simpleGit(targetPath);
  console.log(`\n🔍 Inspecting Git history in: ${targetPath}\n`);

  // 전체 git commit log
  const log = await git.log();
  const results: Record<
    string,
    { commit: string; date: string; lines: Set<number> }
  > = {};

  for (const commit of log.all) {
    try {
      // 특정 커밋의 파일 변경 이력(diff)
      const diff: string = await git.show([commit.hash]);
      const files: string[] = parseChangedFiles(diff);

      for (const file of files) {
        const filePath = path.join(targetPath, file);

        // file 유무, 파일 상태
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (containsNonEnglish(line)) {
              if (!results[file]) {
                // 객체 동적 키 사용
                results[file] = {
                  commit: commit.hash,
                  date: commit.date,
                  // Set 으로 중복된 내용 삭제
                  lines: new Set<number>(),
                };
              }
              results[file].lines.add(index + 1);
            }
          });
        }
      }
    } catch (err) {
      console.error(
        `❌ Error processing commit ${commit.hash}: ${err.message}`,
      );
    }
  }

  printResults(results);
}

function parseChangedFiles(diff: string): string[] {
  const changedFiles = [];
  const diffLines = diff.split('\n');
  for (const line of diffLines) {
    if (line.startsWith('+++ b/')) {
      const filePath = line.replace('+++ b/', '').trim();

      // node_modules 폴더 내의 파일 제외
      if (!filePath.includes('node_modules')) {
        changedFiles.push(filePath);
      }
    }
  }
  return changedFiles;
}

function containsNonEnglish(content: string): boolean {
  const nonEnglishRegex = /[\u4E00-\u9FFF\uAC00-\uD7AF]+/; // 한글 및 중국어 감지
  return nonEnglishRegex.test(content);
}

function printResults(
  results: Record<string, { commit: string; date: string; lines: Set<number> }>,
) {
  if (Object.keys(results).length === 0) {
    console.log('✅ No non-English content found in Git history!');
    return;
  }

  console.log('❗ Non-English content detected in Git history:\n');
  for (const [file, data] of Object.entries(results)) {
    console.log(`📄 File: ${file}`);
    console.log(`   Commit: ${data.commit}`);
    console.log(`   Date: ${data.date}`);
    console.log(`   Total Issues: ${data.lines.size}`);
    console.log(`   Lines: ${[...data.lines].join(', ')}`);
  }
  console.log('\n🔍 Git History Inspection Complete!');
}
