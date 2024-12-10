## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## 명령어 옵션
```bash

$ node dist/main.js inspect [옵션]

# 예시 (git 커밋 이력 검사 및 임시 클론된 repo 삭제)
$ node dist/main.js inspect --url <repo-url> --git --delete

```
| **옵션**               | **설명**                                     | **기본값** |
|------------------------|---------------------------------------------|------------|
| `-p, --path <path>`    | 검사할 **로컬 프로젝트 경로**를 설정합니다.   | `.`        |
| `-u, --url <url>`      | 검사할 원격 **Git 리포지토리 URL**을 입력합니다. | 없음       |
| `-g, --git`            | Git 커밋 이력도 함께 검사합니다.              | 없음       |
| `-d, --delete`         | 임시 클론된 리포지토리를 삭제합니다.          | 없음       |




## **4. 주의 사항**

### **1. `node_modules` 및 미디어 파일 제외**
- `node_modules` 폴더와 다음 파일들은 검사에서 자동으로 제외됩니다:
    - 이미지 파일: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp` 등
    - 음악 파일: `.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a` 등
    - 영상 파일: `.mp4`, `.mkv`, `.avi`, `.mov`, `.flv`, `.wmv`, `.webm` 등
    - 기타 파일: `.bin`, `.zip`, `.pdf`, `.rlp`

---

### **2. 2GB 이상의 파일**
- **2GB**를 초과하는 파일은 검사에서 자동으로 건너뜁니다.

---

### **3. 원격 리포지토리 (`--url` 옵션)**
- `--url` 옵션으로 원격 **Git 리포지토리**를 검사할 경우,  
  임시 디렉토리가 **`temp-clone`** 이름으로 생성됩니다.

- **`--delete` 옵션**을 사용하면, 검사 완료 후 **임시 폴더**가 자동으로 삭제됩니다.  

