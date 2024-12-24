import { Injectable } from '@nestjs/common';
import { inspectFiles } from './file-inspector';
import { inspectGitHistory } from './git-inspector';

@Injectable()
export class CliService {
  async runInspection(
    targetPath: string,
    inspectGit: boolean,
    isLocalPath: boolean,
  ) {
    console.log(`Running inspection on: ${targetPath}`);

    // Inspect files with the isLocalPath flag
    await inspectFiles(targetPath, isLocalPath);

    if (inspectGit) {
      console.log('Inspecting Git history...');
      await inspectGitHistory(targetPath);
    }
  }
}
