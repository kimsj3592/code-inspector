import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as dotenv from 'dotenv';
import simpleGit from 'simple-git';

dotenv.config();

const program = new Command();

program
  .command('inspect')
  .description('Inspect files and Git history for non-English content.')
  .option('-p, --path <path>', 'Local path to project', '.')
  .option('-u, --url <url>', 'Git repository URL')
  .option('-g, --git', 'Inspect Git history')
  .option('--no-filter', 'Do not filter branches older than 2 years')
  .option('-d, --delete', 'Clean up temporary files')
  .action(async (options) => {
    let targetPath = options.path;
    const isLocalPath = !options.url;

    if (options.url) {
      targetPath = path.join(process.cwd(), 'temp-clone');

      if (fs.existsSync(targetPath)) {
        await fs.remove(targetPath);
      }

      console.log(`\n🔗 Cloning repository from ${options.url}`);
      await simpleGit().clone(options.url, targetPath);
    }

    const { inspectFiles } = await import('./file-inspector');
    const { inspectGitHistory } = await import('./git-inspector');

    if (options.git) {
      console.log('\n🔍 Inspecting Git history...');
      const filterOldBranches = options.noFilter !== true;
      await inspectGitHistory(targetPath, filterOldBranches);
    }

    console.log(`\n🔍 Inspecting project at: ${targetPath}`);
    await inspectFiles(targetPath, isLocalPath, options.noFilter !== true);

    if (!isLocalPath && options.delete) {
      console.log('\n🧹 Cleaning up temporary files...');
      await fs.remove(targetPath);
    }
  });

program
  .command('inspect-urls')
  .description('Inspect multiple projects from a predefined list of URLs.')
  .option('--no-filter', 'Do not filter branches updated over 2 years ago')
  .action(async (options) => {
    console.log('🔍 Starting inspection of multiple projects...');

    const accessToken = process.env.GITLAB_ACCESS_TOKEN;
    const baseUrl = process.env.GITLAB_BASE_URL;
    const startGroupId = process.env.GITLAB_START_GROUP_ID;

    if (!accessToken || !baseUrl || !startGroupId) {
      console.error('❌ Missing required environment variables.');
      console.error(
        'Ensure GITLAB_ACCESS_TOKEN, GITLAB_BASE_URL, and GITLAB_START_GROUP_ID are set in the .env file.',
      );
      process.exit(1);
    }

    const { inspectProjects } = await import('./inspect-projects');
    const filterOldBranches = !options.noFilter;
    await inspectProjects(filterOldBranches);
  });

program.parse(process.argv);
