# **Non-English Character Inspector**

A CLI tool to inspect **non-English characters (Korean, Chinese)** in source code files and Git commit history. The tool helps developers identify and review files or Git commits that include unwanted non-English content.

---

## **Project Setup**

### **1. Install Dependencies**
Make sure you have **Node.js** installed, and run the following command to install the required dependencies:

```bash
$ npm install
```

### **2. Build the Project**
If you are using TypeScript, compile the code into JavaScript:

```bash
$ npm run build
```

### **3. Configure `.env` File**
To use the `inspect-urls` command, you need to configure a `.env` file with the following variables:



- **`GITLAB_ACCESS_TOKEN`**: Your GitLab personal access token.
- **`GITLAB_BASE_URL`**: GitLab API base URL.
- **`GITLAB_START_GROUP_ID`**: The starting group ID for inspecting projects.

---

## **Command Options**

Run the tool using the following syntax:

```bash
$ node dist/main.js inspect [options]
```

### **Available Options**

| **Option**             | **Description**                                                                 | **Default** |
|------------------------|--------------------------------------------------------------------------------|-------------|
| `-p, --path <path>`    | Set the **local project path** to inspect.                                      | `.`         |
| `-u, --url <url>`      | Specify the **Git repository URL** to inspect.                                  | None        |
| `-g, --git`            | Inspect the **Git commit history** as well.                                     | None        |
| `-d, --delete`         | Delete the **temporary cloned repository**.                                     | None        |
| `--no-filter`          | Do not filter branches updated over 2 years ago (includes all branches in scan) | Filter enabled |

---

## **Features**

### **1. Inspect Files**
- Detect non-English characters (Korean, Chinese) in source code files.
- **Excluded Files:** Automatically excludes unnecessary files such as:
  - **Node modules**: `node_modules/`
  - **Media files**: `.png`, `.jpg`, `.mp3`, `.mp4`, etc.
  - **Binary files**: `.zip`, `.pdf`, `.bin`, etc.

---

### **2. Inspect Git Commit History**
- Search for non-English characters within files in the Git commit history.
- Identify issues even in **deleted files** and inspect **commit messages**.
- Supports cloning remote repositories temporarily for inspection.

---





## **Notes**

### **1. Excluded Files**
The following files and directories are automatically excluded from inspection:
- `node_modules` directory
- Media files: `.png`, `.jpg`, `.jpeg`, `.gif`, `.mp4`, `.mp3`, etc.
- Binary files: `.zip`, `.pdf`, `.bin`, `.dll`

### **2. Remote Repository Support**
- When using the `--url` option to inspect a remote Git repository:
  - A temporary directory `temp-clone` is created.
  - Use the `--delete` option to automatically remove this directory after the inspection.

### **3. Active Branch Filtering**
- For Git commit history inspection, only **active branches** updated within the last 2 years are scanned by default.
- Use the `--no-filter` option to include **all branches**, regardless of their last update time.

### **4. GitLab Group Inspection**
- Fetch all project URLs from a specified GitLab group recursively.
- Inspect each project for non-English content in files and Git history.
- Automatically retries failed operations up to 3 times.
- Saves inspection results in `batch-results-<index>.json` files.
- Failed projects are logged in `failed-projects.json`.

---

## **Advanced Examples**



- Inspect a **specific directory**:
  ```bash
  $ node dist/main.js inspect --path /path/to/project
  ```

- Inspect a **remote Git repository**:
  ```bash
  $ node dist/main.js inspect --url git@github.com:user/repo.git --git
  ```

- Inspect and **delete the cloned repository** after the inspection:
  ```bash
  $ node dist/main.js inspect --url git@github.com:user/repo.git --git --delete
  ```

- Inspect **multiple GitLab projects** from a predefined group:
  ```bash
  $ node dist/main.js inspect-urls
  ```

- Include **all branches** (including those updated over 2 years ago):
  ```bash
  $ node dist/main.js inspect-urls --no-filter
  ```