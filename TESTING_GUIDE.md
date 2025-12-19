# Comprehensive Testing Guide
## Proxmox Multi-Tenant Platform

This guide covers all aspects of automated testing for the platform.

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Backend Testing](#backend-testing)
3. [Frontend Testing](#frontend-testing)
4. [End-to-End Testing](#end-to-end-testing)
5. [CI/CD Integration](#cicd-integration)
6. [Test Data Management](#test-data-management)
7. [Best Practices](#best-practices)

---

## Testing Overview

### Test Types

1. **Unit Tests** - Test individual functions/modules in isolation
   - Backend: Services, utilities, helpers
   - Frontend: Components, hooks, utilities
   - Coverage Goal: 80%+

2. **Integration Tests** - Test API endpoints with database
   - Backend: Controllers + Database
   - Coverage Goal: 90%+ for critical paths

3. **Component Tests** - Test React components with mocked APIs
   - Frontend: Pages, dialogs, forms
   - Coverage Goal: 70%+

4. **End-to-End Tests** - Test full user workflows
   - Browser automation with Playwright
   - Coverage Goal: Critical user journeys

### Test Stack

- **Backend**: Jest + Supertest
- **Frontend**: Jest + React Testing Library
- **E2E**: Playwright
- **CI/CD**: GitHub Actions

---

## Backend Testing

### Setup

```bash
cd /var/www/multpanelreact/backend

# Install dependencies
npm install --save-dev jest ts-jest supertest @types/jest @types/supertest

# Create test database
mysql -u root -p -e "CREATE DATABASE proxmox_tenant_test;"

# Set environment variables
export DATABASE_URL="mysql://root:password@localhost:3306/proxmox_tenant_test"
export JWT_SECRET="test-secret-key"
export ENCRYPTION_KEY="test-encryption-key"

# Run migrations
npx prisma migrate deploy
npx prisma generate
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- backupExecutorService.test.ts

# Run with coverage
npm run test:coverage

# Watch mode (auto-run on file changes)
npm run test:watch

# Run integration tests only
npm run test:integration
```

### Writing Backend Tests

#### Unit Test Example

```typescript
// services/emailService.test.ts
import { sendEmail } from '../services/emailService';

describe('Email Service', () => {
  it('should send email with valid SMTP config', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Hello',
    });

    expect(result.success).toBe(true);
  });
});
```

#### Integration Test Example

```typescript
// controllers/vmsController.test.ts
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

---

## Frontend Testing

### Setup

```bash
cd /var/www/multpanelreact/frontend

# Install dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- VMsPage.test.tsx

# Run with coverage
npm test -- --coverage --watchAll=false

# Watch mode
npm test -- --watch
```

### Writing Frontend Tests

#### Component Test Example

```typescript
// pages/VMsPage.test.tsx
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

---

## End-to-End Testing

### Setup

```bash
# Install Playwright
npm install --save-dev @playwright/test

# Install browsers
npx playwright install chromium firefox webkit
```

### Running E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run in UI mode (interactive)
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific browser
npx playwright test --project=chromium

# Generate HTML report
npx playwright show-report
```

### Writing E2E Tests

```typescript
// e2e/auth.spec.ts
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

## CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/ci.yml` file automates testing on every push/PR:

1. **Backend Tests**
   - Spins up MySQL database
   - Runs migrations
   - Executes unit + integration tests
   - Generates coverage report

2. **Frontend Tests**
   - Runs component tests
   - Generates coverage report
   - Builds production bundle

3. **E2E Tests**
   - Starts backend + frontend servers
   - Runs Playwright tests
   - Uploads test reports

4. **Lint & Type Check**
   - ESLint validation
   - TypeScript compilation check

5. **Security Scan**
   - npm audit
   - Snyk vulnerability scan

6. **Deploy**
   - Runs only on `main` branch
   - SSH to server
   - Pull latest code
   - Build and restart services

### Required Secrets

Add these to GitHub repository settings:

```
DEPLOY_HOST=192.168.142.237
DEPLOY_USER=root
DEPLOY_SSH_KEY=<private key content>
SLACK_WEBHOOK=<slack webhook URL>
SNYK_TOKEN=<snyk API token>
```

---

## Test Data Management

### Database Seeding

Create test fixtures for consistent test data:

```typescript
// tests/fixtures/companies.ts
export const testCompany = {
  name: 'Test Company',
  status: 'active',
};

export const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'hashedpassword',
  role: 'user',
};
```

### Cleanup Strategy

```typescript
afterEach(async () => {
  // Clean up test data after each test
  await prisma.virtual_machines.deleteMany({
    where: { name: { startsWith: 'test-' } },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

---

## Best Practices

### 1. Test Naming

```typescript
// Good
test('should create VM with valid data', async () => {});
test('should reject VM creation without VMID', async () => {});

// Bad
test('VM creation', async () => {});
test('test1', async () => {});
```

### 2. AAA Pattern

```typescript
test('should send notification email', async () => {
  // Arrange
  const email = 'test@example.com';
  const subject = 'Test Subject';

  // Act
  const result = await sendEmail(email, subject);

  // Assert
  expect(result.success).toBe(true);
});
```

### 3. Test Independence

```typescript
// Each test should be independent
test('should create user', async () => {
  // Create user
  const user = await createUser(userData);

  // Clean up in same test
  await deleteUser(user.id);
});
```

### 4. Mock External Services

```typescript
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

test('should call Proxmox API', async () => {
  mockedAxios.post.mockResolvedValue({ data: { success: true } });

  const result = await startVM(100);

  expect(result.success).toBe(true);
  expect(mockedAxios.post).toHaveBeenCalledWith(
    expect.stringContaining('/qemu/100/status/start'),
    expect.any(Object)
  );
});
```

### 5. Test Coverage Goals

- **Critical Paths**: 100% (auth, billing, data loss)
- **Business Logic**: 90% (VM management, backups)
- **Utilities**: 80%
- **UI Components**: 70%

### 6. Performance Testing

```typescript
test('should load VMs in under 1 second', async () => {
  const start = Date.now();

  const response = await request(app).get('/api/vms');

  const duration = Date.now() - start;
  expect(duration).toBeLessThan(1000);
});
```

---

## Test Execution Checklist

### Before Committing

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No ESLint errors
- [ ] TypeScript compiles without errors
- [ ] Code coverage > 80%

### Before Deploying

- [ ] All E2E tests pass
- [ ] Security scan shows no high-severity issues
- [ ] Performance tests show acceptable response times
- [ ] Manual smoke testing completed
- [ ] Database migrations tested

---

## Troubleshooting

### Tests Timing Out

```bash
# Increase Jest timeout
jest.setTimeout(30000);

# Or per test
test('slow test', async () => {}, 30000);
```

### Database Connection Issues

```bash
# Check connection
mysql -u root -p -e "SELECT 1;"

# Verify environment variable
echo $DATABASE_URL
```

### Playwright Browser Issues

```bash
# Reinstall browsers
npx playwright install --force

# Run in debug mode
PWDEBUG=1 npx playwright test
```

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

---

**Last Updated**: December 19, 2025
**Version**: 1.0
**Status**: Production Ready
