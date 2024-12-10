import * as path from 'path';
import * as fastGlob from 'fast-glob';
import * as fs from 'fs';

export async function inspectFiles(targetPath: string) {
  // 상대 경로를 절대 경로로 변환
  const resolvedPath = path.resolve(targetPath);
  // console.log(`\n🔍 Inspecting files in: ${resolvedPath}\n`);

  const files = await fastGlob(`${resolvedPath}/**/*`, {
    dot: true,
    onlyFiles: true,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/*.png',
      '**/*.jpg',
      '**/*.jpeg',
      '**/*.gif',
      '**/*.svg',
      '**/*.webp', // 이미지 파일
      '**/*.mp3',
      '**/*.wav',
      '**/*.ogg',
      '**/*.flac',
      '**/*.aac',
      '**/*.m4a', // 음악 파일
      '**/*.mp4',
      '**/*.mkv',
      '**/*.avi',
      '**/*.mov',
      '**/*.flv',
      '**/*.wmv',
      '**/*.webm', // 동영상 파일
      '**/*.zip',
      '**/*.pdf',
      '**/*.bin',
      '**/*.rlp',
    ],
  });

  // 파일명과 문제가 발견될 줄 번호를 저장하는 객체
  const results: Record<string, number[]> = {};
  const skippedLargeFiles: string[] = [];

  for (const file of files) {
    if (isMediaFile(file)) continue;

    try {
      const stats = fs.statSync(file);
      if (stats.size > 2 * 1024 * 1024 * 1024) {
        skippedLargeFiles.push(file);
        continue;
      }

      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (containsNonEnglish(line)) {
          if (!results[file]) {
            results[file] = [];
          }
          results[file].push(index + 1);
        }
      });
    } catch (err) {
      console.error(`❌ Error reading file: ${file}`, err.message);
    }
  }

  printResults(results, skippedLargeFiles);
}

function isMediaFile(file: string): boolean {
  return /\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff|ico|mp3|wav|ogg|flac|aac|m4a|mp4|mkv|avi|mov|flv|wmv|webm)$/i.test(
    file,
  ); // 이미지 및 미디어 파일 검사
}

function containsNonEnglish(content: string): boolean {
  const nonEnglishRegex = /[\u4E00-\u9FFF\uAC00-\uD7AF]+/; // 한글 및 중국어 감지
  return nonEnglishRegex.test(content);
}

function printResults(
  results: Record<string, number[]>,
  skippedLargeFiles: string[],
) {
  if (skippedLargeFiles.length > 0) {
    console.warn('⚠️ Skipped large files (>2GB):');
    skippedLargeFiles.forEach((file) => {
      console.warn(`   - ${file}`);
    });
    console.log();
  }

  if (Object.keys(results).length === 0) {
    console.log('✅ No non-English content found!');
    return;
  }

  console.log('❗ Non-English content detected:\n');
  for (const [file, lines] of Object.entries(results)) {
    console.log(`📄 File: ${file}`);
    console.log(`   Total Issues: ${lines.length}`);
    console.log(`   Lines: ${lines.join(', ')}`);
  }
  console.log('\n🔍 Inspection Complete!');
}
