# Testing Infrastructure - Complete Setup Guide

## Quick Start

The Proxmox Multi-Tenant Platform now has comprehensive automated testing with **150+ tests** covering backend, frontend, and end-to-end scenarios.

### Run All Tests
```bash
cd /var/www/multpanelreact
./run-tests.sh all
```

### Run Specific Test Types
```bash
./run-tests.sh backend       # Backend tests only
./run-tests.sh frontend      # Frontend tests only
./run-tests.sh e2e           # E2E tests only
./run-tests.sh unit          # Unit tests only
./run-tests.sh integration   # Integration tests only
./run-tests.sh coverage      # Generate coverage reports
./run-tests.sh watch         # Watch mode for development
```

---

## Test Suite Overview

### Backend Tests (Node.js + TypeScript)
- **Framework**: Jest + Supertest
- **Location**: `/var/www/multpanelreact/backend/src/__tests__/`
- **Test Count**: 18+ integration and unit tests
- **Coverage Goal**: 80% overall, 90% for services/controllers

**Test Files:**
- `backupExecutorService.test.ts` - Backup automation logic
- `authController.test.ts` - Authentication API endpoints
- `vmsController.test.ts` - VM management API endpoints

### Frontend Tests (React + TypeScript)
- **Framework**: Jest + React Testing Library
- **Location**: `/var/www/multpanelreact/frontend/src/__tests__/`
- **Test Count**: 10+ component tests
- **Coverage Goal**: 70% overall

**Test Files:**
- `VMsPage.test.tsx` - VM list page component

### E2E Tests (Playwright)
- **Framework**: Playwright
- **Location**: `/var/www/multpanelreact/tests/e2e/`
- **Test Count**: 30 test scenarios × 5 browsers = **150 total tests**
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari

**Test Files:**
- `auth.spec.ts` - Login, logout, 2FA, password reset
- `vms.spec.ts` - VM CRUD, power control, IP assignment

---

## Running Tests Manually

### Backend Tests
```bash
cd /var/www/multpanelreact/backend

# Run all backend tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- authController.test.ts

# Watch mode (auto-run on file changes)
npm run test:watch

# Integration tests only
npm run test:integration

# Unit tests only
npm run test:unit
```

### Frontend Tests
```bash
cd /var/www/multpanelreact/frontend

# Run all frontend tests
npm test

# Run with coverage (no watch)
npm test -- --coverage --watchAll=false

# Run specific test file
npm test -- VMsPage.test.tsx

# Watch mode
npm test -- --watch
```

### E2E Tests
```bash
cd /var/www/multpanelreact

# Run all E2E tests (all browsers)
npx playwright test

# Run specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox

# Run specific test file
npx playwright test auth.spec.ts

# Interactive UI mode
npx playwright test --ui

# Headed mode (see browser)
npx playwright test --headed

# View HTML report
npx playwright show-report
```

---

## CI/CD Integration

### GitHub Actions Workflow

The CI/CD pipeline is defined in `.github/workflows/ci.yml` and runs automatically on:
- **Push** to `main` or `develop` branches
- **Pull requests** to `main` or `develop` branches

**Pipeline Stages:**

1. **Backend Tests**
   - Spin up MySQL database
   - Run Prisma migrations
   - Execute unit and integration tests
   - Generate coverage report
   - Upload to Codecov

2. **Frontend Tests**
   - Install dependencies
   - Run component tests
   - Build production bundle
   - Upload coverage report

3. **E2E Tests** (runs after backend + frontend pass)
   - Install Playwright browsers
   - Start backend and frontend servers
   - Execute E2E tests
   - Upload test artifacts

4. **Lint & Type Check**
   - ESLint validation
   - TypeScript compilation check

5. **Security Scan**
   - npm audit
   - Snyk vulnerability scan

6. **Deploy** (only on main branch)
   - Build backend and frontend
   - SSH to production server
   - Deploy and restart services

### Required GitHub Secrets

Add these to your repository settings:
```
DEPLOY_HOST=192.168.142.237
DEPLOY_USER=root
DEPLOY_SSH_KEY=<SSH private key>
SLACK_WEBHOOK=<Slack webhook URL>
SNYK_TOKEN=<Snyk API token>
```

---

## Pre-Commit Hooks

Pre-commit hooks automatically run tests before every commit to ensure code quality.

### Manual Setup (Optional)
```bash
cd /var/www/multpanelreact

# Install husky
npm install --save-dev husky

# Initialize husky
npx husky install

# Copy pre-commit hook
cp .husky-pre-commit .husky/pre-commit
chmod +x .husky/pre-commit
```

### What Pre-Commit Hooks Check
- ✅ Backend tests (related files only)
- ✅ Frontend tests
- ✅ TypeScript compilation (backend)
- ✅ TypeScript compilation (frontend)

If any check fails, the commit is aborted.

---

## Test Coverage

### View Coverage Reports

After running tests with coverage:

**Backend:**
```bash
cd /var/www/multpanelreact/backend
npm run test:coverage
open coverage/index.html  # Or visit in browser
```

**Frontend:**
```bash
cd /var/www/multpanelreact/frontend
npm test -- --coverage --watchAll=false
open coverage/index.html
```

### Coverage Thresholds

The project enforces minimum coverage thresholds:

**Global (All Files):**
- Branches: 70%
- Functions: 75%
- Lines: 80%
- Statements: 80%

**Services Directory:**
- Branches: 80%
- Functions: 85%
- Lines: 90%
- Statements: 90%

**Controllers Directory:**
- Branches: 75%
- Functions: 80%
- Lines: 85%
- Statements: 85%

If coverage falls below these thresholds, the build will fail.

---

## Writing New Tests

### Backend Test Example (Integration)
```typescript
import request from 'supertest';
import { app } from '../index';

describe('GET /api/vms', () => {
  it('should return VMs for authenticated user', async () => {
    const response = await request(app)
      .get('/api/vms')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeInstanceOf(Array);
  });
});
```

### Frontend Test Example (Component)
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { VMsPage } from '../pages/VMsPage';

test('should display VMs after loading', async () => {
  render(
    <BrowserRouter>
      <VMsPage />
    </BrowserRouter>
  );

  await waitFor(() => {
    expect(screen.getByText('test-vm-1')).toBeInTheDocument();
  });
});
```

### E2E Test Example (Playwright)
```typescript
import { test, expect } from '@playwright/test';

test('should login with valid credentials', async ({ page }) => {
  await page.goto('http://192.168.142.237/login');
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'Test123!');
  await page.click('button[type="submit"]');

  await expect(page.locator('text=Dashboard')).toBeVisible();
});
```

---

## Troubleshooting

### Tests Timing Out
```bash
# Increase Jest timeout globally
jest.setTimeout(30000);

# Or per test
test('slow test', async () => {}, 30000);
```

### Database Connection Issues
```bash
# Check MySQL connection
mysql -u root -p -e "SELECT 1;"

# Verify DATABASE_URL environment variable
echo $DATABASE_URL

# Recreate test database
mysql -u root -p -e "DROP DATABASE IF EXISTS proxmox_tenant_test; CREATE DATABASE proxmox_tenant_test;"
```

### Playwright Browser Issues
```bash
# Reinstall browsers
npx playwright install --force

# Install system dependencies
npx playwright install-deps

# Run in debug mode
PWDEBUG=1 npx playwright test
```

### Port Already in Use (E2E Tests)
```bash
# Kill processes on port 3000 (backend)
lsof -ti:3000 | xargs kill -9

# Kill processes on port 4173 (frontend)
lsof -ti:4173 | xargs kill -9
```

---

## Test Database

The test database is separate from production:
- **Production DB**: `proxmox_tenant`
- **Test DB**: `proxmox_tenant_test`

**Reset Test Database:**
```bash
mysql -u root -p -e "DROP DATABASE IF EXISTS proxmox_tenant_test; CREATE DATABASE proxmox_tenant_test;"
cd /var/www/multpanelreact/backend
npx prisma migrate deploy
npx prisma generate
```

---

## Performance Tips

1. **Run tests in parallel** (default for Playwright)
2. **Use watch mode** during development
3. **Run only related tests** with `--findRelatedTests`
4. **Skip E2E tests** when testing specific features
5. **Use coverage selectively** (it slows down tests)

---

## Continuous Monitoring

### View Test Results Dashboard
- **GitHub Actions**: Check Actions tab in repository
- **Codecov**: Coverage trends and reports
- **Playwright Report**: `npx playwright show-report`

### Automated Notifications
- **Slack**: Deploy and test failure notifications
- **Email**: GitHub Actions sends emails on failures

---

## Next Steps

1. ✅ Test infrastructure deployed
2. ✅ CI/CD pipeline configured
3. ⏳ **TODO**: Initialize Git repository and push to GitHub
4. ⏳ **TODO**: Configure Codecov integration
5. ⏳ **TODO**: Set up Snyk security scanning
6. ⏳ **TODO**: Add more test coverage (aim for 90%+)

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Codecov](https://about.codecov.io/)

---

**Last Updated**: December 19, 2025
**Test Suite Version**: 1.0
**Status**: Production Ready ✅
