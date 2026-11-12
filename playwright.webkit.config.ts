import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';
/** Optional local Safari-engine suite; CI installs the required system libraries. */
export default defineConfig({
 ...base,
 use: { baseURL:'http://127.0.0.1:4173' },
 projects: [{name:'safari-tablet',use:{...devices['iPad Pro 11'],browserName:'webkit'}}],
});
