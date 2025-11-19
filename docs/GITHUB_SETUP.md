# GitHub Repository Setup Guide

Complete guide to creating and pushing this project to GitHub.

## Prerequisites

- Git installed locally
- GitHub account
- SSH key configured (recommended) or HTTPS credentials

## Step 1: Create GitHub Repository

### Option A: Via GitHub Web Interface

1. Go to [github.com](https://github.com)
2. Click the "+" icon → "New repository"
3. Fill in repository details:
   - **Repository name**: `collaborative-dev-platform` (or your choice)
   - **Description**: "A Git-like project management platform with real-time collaboration and self-learning code rules"
   - **Visibility**: Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Click "Create repository"

### Option B: Via GitHub CLI

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Authenticate
gh auth login

# Create repository
gh repo create collaborative-dev-platform \
  --description "A Git-like project management platform with real-time collaboration and self-learning code rules" \
  --public  # or --private
```

## Step 2: Configure Git Remote

Your local repository is already initialized. Now connect it to GitHub:

```bash
# Navigate to project directory
cd /root/projects/platform

# Add remote (replace <username> with your GitHub username)
git remote add origin git@github.com:<username>/collaborative-dev-platform.git

# Verify remote
git remote -v
```

**Using HTTPS instead of SSH:**
```bash
git remote add origin https://github.com/<username>/collaborative-dev-platform.git
```

## Step 3: Initial Commit

The project files are ready. Let's create the first commit:

```bash
# Check status
git status

# Add all files
git add .

# Create initial commit
git commit -m "feat: initialize collaborative development platform

- Set up project structure with backend and frontend
- Configure Node.js/Express backend with PostgreSQL and Redis
- Create Bootstrap 5 frontend with vanilla JavaScript
- Add comprehensive database schema with migrations
- Implement configuration for authentication and storage
- Add project documentation (README, ARCHITECTURE, SETUP)
- Configure .gitignore and environment templates

This commit establishes the foundation for Phase 1 development."

# Verify commit
git log --oneline
```

## Step 4: Push to GitHub

```bash
# Push to main branch
git push -u origin main

# If you get an error about branch naming:
git branch -M main
git push -u origin main
```

## Step 5: Verify on GitHub

1. Visit your repository: `https://github.com/<username>/collaborative-dev-platform`
2. Verify all files are present
3. Check README.md is displayed properly
4. Review commit history

## Step 6: Configure Repository Settings

### Add Repository Description & Topics

1. Go to repository settings
2. Add description: "Git-like project management platform with real-time collaboration"
3. Add topics: `collaboration`, `project-management`, `nodejs`, `postgresql`, `bootstrap5`, `real-time`, `vanilla-javascript`

### Set Up Branch Protection (Recommended)

1. Go to Settings → Branches
2. Add rule for `main` branch:
   - ✓ Require pull request reviews before merging
   - ✓ Require status checks to pass
   - ✓ Require branches to be up to date

### Add Repository Secrets (for CI/CD)

If you plan to use GitHub Actions:

1. Go to Settings → Secrets and variables → Actions
2. Add secrets:
   - `DB_PASSWORD`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `AWS_ACCESS_KEY_ID` (if using)
   - `AWS_SECRET_ACCESS_KEY` (if using)

## Step 7: Create Development Branch

```bash
# Create and switch to development branch
git checkout -b development

# Push development branch
git push -u origin development

# Switch back to main
git checkout main
```

## Step 8: Add Collaborators (Optional)

1. Go to Settings → Collaborators
2. Click "Add people"
3. Enter GitHub username or email
4. Select permission level

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples:

```bash
# Feature
git commit -m "feat(auth): implement JWT authentication system"

# Bug fix
git commit -m "fix(api): resolve CORS issue on production"

# Documentation
git commit -m "docs: add API endpoint documentation"

# Refactor
git commit -m "refactor(database): optimize query performance"
```

## Branch Strategy

### Main Branches
- `main` - Production-ready code
- `development` - Integration branch for features

### Feature Branches
```bash
# Create feature branch
git checkout -b feature/user-authentication

# Work on feature...
git add .
git commit -m "feat(auth): add user registration endpoint"

# Push feature branch
git push -u origin feature/user-authentication

# Create pull request on GitHub
```

### Workflow
```
feature/xxx → development → main
```

## Recommended GitHub Actions

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main, development ]
  pull_request:
    branches: [ main, development ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: platform_test
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        cd backend
        npm ci
    
    - name: Run tests
      run: |
        cd backend
        npm test
      env:
        NODE_ENV: test
        DB_HOST: localhost
        DB_PORT: 5432
        DB_NAME: platform_test
        DB_USER: postgres
        DB_PASSWORD: postgres
        REDIS_HOST: localhost
        REDIS_PORT: 6379
```

## GitHub Repository Best Practices

### README Badges

Add badges to README.md:

```markdown
[![CI](https://github.com/<username>/collaborative-dev-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/<username>/collaborative-dev-platform/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
```

### Issue Templates

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug report
about: Create a report to help us improve
---

**Describe the bug**
A clear description of the bug.

**To Reproduce**
Steps to reproduce the behavior.

**Expected behavior**
What you expected to happen.

**Environment:**
- OS: [e.g. Ubuntu 22.04]
- Node.js version: [e.g. 18.0.0]
- Browser: [e.g. Chrome 120]
```

### Pull Request Template

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Description
Brief description of changes

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests passing
```

## Useful Git Commands

```bash
# View commit history
git log --oneline --graph --all

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Update from remote
git pull origin main

# View changes
git diff

# Stash changes
git stash
git stash pop

# Clean up
git clean -fd  # Remove untracked files

# View remote info
git remote show origin
```

## Next Steps

1. ✓ Repository created on GitHub
2. ✓ Code pushed to remote
3. ✓ Verify all files present
4. Set up CI/CD (optional)
5. Add collaborators (optional)
6. Start working on Phase 1 features!

## Troubleshooting

### Authentication Failed

**SSH:**
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub: Settings → SSH Keys
cat ~/.ssh/id_ed25519.pub
```

**HTTPS:**
```bash
# Use personal access token
# GitHub → Settings → Developer settings → Personal access tokens
```

### Push Rejected

```bash
# Pull latest changes first
git pull origin main --rebase

# Then push
git push origin main
```

### Large Files

If you accidentally added large files:

```bash
# Remove from Git but keep locally
git rm --cached large-file.zip

# Add to .gitignore
echo "*.zip" >> .gitignore

# Commit
git commit -m "chore: remove large file from git"
```

## Support

For GitHub-specific issues:
- [GitHub Docs](https://docs.github.com/)
- [GitHub Community](https://github.community/)
