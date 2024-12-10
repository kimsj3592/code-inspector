import { Injectable } from '@nestjs/common';
import { inspectFiles } from './file-inspector';
import { inspectGitHistory } from './git-inspector';

@Injectable()
export class CliService {
  async runInspection(targetPath: string, inspectGit: boolean) {
    console.log(`Running inspection on: ${targetPath}`);
    await inspectFiles(targetPath);

    if (inspectGit) {
      console.log('Inspecting Git history...');
      await inspectGitHistory(targetPath);
    }
  }
}
