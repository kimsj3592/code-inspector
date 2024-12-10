import { Command } from 'commander';
import { inspectFiles } from './file-inspector';
import { inspectGitHistory } from './git-inspector';
import simpleGit from 'simple-git';
import * as fs from 'fs-extra';
import * as path from 'path';

// command 객체 생성
const program = new Command();

program
  .command('inspect')
  .description('Inspect files and Git history for non-English content.')
  .option('-p, --path <path>', 'Local path to project', '.')
  .option('-u, --url <url>', 'Git repository URL')
  .option('-g, --git', 'Inspect Git history')
  .option('-d, --delete', 'Cleaning up temporary files')
  .action(async (options) => {
    let targetPath = options.path;

    // url 옵션, git clone
    if (options.url) {
      targetPath = path.join(process.cwd(), 'temp-clone');

      // temp-clone 디렉토리가 이미 존재하면 삭제
      if (fs.existsSync(targetPath)) await fs.remove(targetPath);

      console.log(`\n🔗 Cloning repository from ${options.url}`);
      await simpleGit().clone(options.url, targetPath);
    }

    // 파일 검사 실행
    console.log(`\n🔍 Inspecting project at: ${targetPath}`);
    await inspectFiles(targetPath);

    // --git, -g 옵션이 설정되어 있는지 확인
    // git 히스토리 커밋내용 확인
    if (options.git) await inspectGitHistory(targetPath);

    // temp-clone 디렉토리 삭제
    if (options.delete) {
      console.log('\n🧹 Cleaning up temporary files...');
      await fs.remove(targetPath);
    }
  });

program.parse(process.argv);
