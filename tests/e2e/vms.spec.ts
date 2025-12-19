/**
 * End-to-End tests for VM Management
 * Tests VM creation, power control, editing, deletion
 */

import { test, expect } from '@playwright/test';

test.describe('VM Management', () => {
  const baseURL = process.env.BASE_URL || 'http://192.168.142.237';

  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto(`${baseURL}/login`);
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to VMs page
    await page.click('text=Virtual Machines');
    await page.waitForURL('**/vms');
  });

  test('should display VMs list', async ({ page }) => {
    await expect(page.locator('text=Virtual Machines')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();

    // Should have column headers
    await expect(page.locator('th:has-text("VMID")')).toBeVisible();
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
  });

  test('should create new VM', async ({ page }) => {
    await page.click('button:has-text("Create VM")');

    // Fill in VM details
    await page.fill('input[name="vmid"]', '9999');
    await page.fill('input[name="name"]', 'test-e2e-vm');
    await page.selectOption('select[name="cluster_id"]', { index: 1 });
    await page.selectOption('select[name="node"]', { index: 1 });
    await page.fill('input[name="cores"]', '2');
    await page.fill('input[name="memory"]', '2048');
    await page.fill('input[name="disk"]', '20');

    // Submit form
    await page.click('button:has-text("Create")');

    // Should show success message
    await expect(page.locator('text=created successfully')).toBeVisible();

    // Should see new VM in list
    await expect(page.locator('text=test-e2e-vm')).toBeVisible();
    await expect(page.locator('text=9999')).toBeVisible();
  });

  test('should validate VM creation form', async ({ page }) => {
    await page.click('button:has-text("Create VM")');

    // Try to submit without filling required fields
    await page.click('button:has-text("Create")');

    // Should show validation errors
    await expect(page.locator('text=required')).toBeVisible();
  });

  test('should search VMs by name', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('test-vm-1');

    // Should filter results
    await expect(page.locator('text=test-vm-1')).toBeVisible();

    // Clear search
    await searchInput.clear();
  });

  test('should filter VMs by status', async ({ page }) => {
    await page.selectOption('select[name="status"]', 'running');

    // Should only show running VMs
    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      await expect(row.locator('text=running')).toBeVisible();
    }
  });

  test('should start stopped VM', async ({ page }) => {
    // Find a stopped VM
    const stoppedRow = page.locator('tr:has(td:text("stopped"))').first();
    const startButton = stoppedRow.locator('button:has-text("Start")');

    await startButton.click();

    // Should show loading state
    await expect(page.locator('text=Starting')).toBeVisible();

    // Should eventually show running status
    await expect(stoppedRow.locator('text=running')).toBeVisible({ timeout: 30000 });
  });

  test('should stop running VM', async ({ page }) => {
    // Find a running VM
    const runningRow = page.locator('tr:has(td:text("running"))').first();
    const stopButton = runningRow.locator('button:has-text("Stop")');

    await stopButton.click();

    // Should show confirmation dialog
    await expect(page.locator('text=Are you sure')).toBeVisible();
    await page.click('button:has-text("Confirm")');

    // Should show loading state
    await expect(page.locator('text=Stopping')).toBeVisible();

    // Should eventually show stopped status
    await expect(runningRow.locator('text=stopped')).toBeVisible({ timeout: 30000 });
  });

  test('should reboot VM', async ({ page }) => {
    const runningRow = page.locator('tr:has(td:text("running"))').first();
    const moreButton = runningRow.locator('button[aria-label="More actions"]');

    await moreButton.click();
    await page.click('text=Reboot');

    // Should show confirmation
    await expect(page.locator('text=Are you sure')).toBeVisible();
    await page.click('button:has-text("Confirm")');

    // Should show rebooting status
    await expect(page.locator('text=Rebooting')).toBeVisible();
  });

  test('should edit VM configuration', async ({ page }) => {
    const vmRow = page.locator('table tbody tr').first();
    const editButton = vmRow.locator('button[aria-label="Edit"]');

    await editButton.click();

    // Should open edit dialog
    await expect(page.locator('text=Edit VM')).toBeVisible();

    // Change cores
    await page.fill('input[name="cores"]', '4');
    await page.fill('input[name="memory"]', '4096');

    await page.click('button:has-text("Save")');

    // Should show success message
    await expect(page.locator('text=updated successfully')).toBeVisible();
  });

  test('should delete VM', async ({ page }) => {
    // Create a VM to delete
    await page.click('button:has-text("Create VM")');
    await page.fill('input[name="vmid"]', '9998');
    await page.fill('input[name="name"]', 'vm-to-delete');
    await page.selectOption('select[name="cluster_id"]', { index: 1 });
    await page.selectOption('select[name="node"]', { index: 1 });
    await page.fill('input[name="cores"]', '1');
    await page.fill('input[name="memory"]', '1024');
    await page.fill('input[name="disk"]', '10');
    await page.click('button:has-text("Create")');

    // Wait for creation
    await expect(page.locator('text=vm-to-delete')).toBeVisible();

    // Delete the VM
    const vmRow = page.locator('tr:has(text("vm-to-delete"))');
    const deleteButton = vmRow.locator('button[aria-label="Delete"]');

    await deleteButton.click();

    // Should show confirmation
    await expect(page.locator('text=Are you sure')).toBeVisible();
    await page.fill('input[name="confirmName"]', 'vm-to-delete');
    await page.click('button:has-text("Delete")');

    // Should show success and VM should disappear
    await expect(page.locator('text=deleted successfully')).toBeVisible();
    await expect(page.locator('text=vm-to-delete')).not.toBeVisible();
  });

  test('should prevent deletion of running VM', async ({ page }) => {
    const runningRow = page.locator('tr:has(td:text("running"))').first();
    const deleteButton = runningRow.locator('button[aria-label="Delete"]');

    await deleteButton.click();

    // Should show error
    await expect(page.locator('text=stop the VM first')).toBeVisible();
  });

  test('should show VM details', async ({ page }) => {
    const vmRow = page.locator('table tbody tr').first();
    const vmName = await vmRow.locator('td').nth(1).textContent();

    await vmRow.click();

    // Should show details panel/page
    await expect(page.locator(`text=${vmName}`)).toBeVisible();
    await expect(page.locator('text=CPU')).toBeVisible();
    await expect(page.locator('text=Memory')).toBeVisible();
    await expect(page.locator('text=Disk')).toBeVisible();
    await expect(page.locator('text=IP Address')).toBeVisible();
  });

  test('should sort VMs by column', async ({ page }) => {
    // Click on Name column header
    await page.click('th:has-text("Name")');

    // Should sort ascending
    const firstRow = page.locator('table tbody tr').first();
    const firstName = await firstRow.locator('td').nth(1).textContent();

    // Click again
    await page.click('th:has-text("Name")');

    // Should sort descending
    const firstRowAfter = page.locator('table tbody tr').first();
    const firstNameAfter = await firstRowAfter.locator('td').nth(1).textContent();

    expect(firstName).not.toBe(firstNameAfter);
  });

  test('should paginate VMs', async ({ page }) => {
    // Assuming there are more than 10 VMs
    const pagination = page.locator('[aria-label="pagination"]');

    if (await pagination.isVisible()) {
      const nextButton = page.locator('button:has-text("Next")');
      await nextButton.click();

      // Page should change
      await expect(page.locator('text=Page 2')).toBeVisible();
    }
  });

  test('should refresh VM list', async ({ page }) => {
    const refreshButton = page.locator('button[aria-label="Refresh"]');
    await refreshButton.click();

    // Should show loading state
    await expect(page.locator('[role="progressbar"]')).toBeVisible();

    // Should reload data
    await expect(page.locator('table tbody tr')).toBeVisible();
  });

  test('should assign IP to VM', async ({ page }) => {
    const vmRow = page.locator('table tbody tr').first();
    const moreButton = vmRow.locator('button[aria-label="More actions"]');

    await moreButton.click();
    await page.click('text=Assign IP');

    // Should show IP assignment dialog
    await expect(page.locator('text=Assign IP Address')).toBeVisible();

    await page.selectOption('select[name="ip_range"]', { index: 1 });
    await page.fill('input[name="ip"]', '192.168.1.200');

    await page.click('button:has-text("Assign")');

    // Should show success
    await expect(page.locator('text=IP assigned successfully')).toBeVisible();
  });
});
