#!/usr/bin/env node

/**
 * Add Missing Scripts to package.json
 * Run this to update your package.json with all necessary scripts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packagePath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Scripts to add
const newScripts = {
  "api:dev": "tsx watch src/api/server.ts",
  "api:build": "tsc -p tsconfig.json",
  "api:start": "node dist/api/server.js",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:integration": "jest src/tests/backend-integration.test.ts",
  "docker:up": "docker-compose up -d",
  "docker:down": "docker-compose down",
  "docker:logs": "docker-compose logs -f",
  "docker:build": "docker-compose build",
  "setup": "node scripts/setup.js",
  "setup:env": "cp .env.example .env",
  "setup:db": "node scripts/setup-database.js",
  "start:all": "node scripts/start-all.js",
  "start:full": "npm run docker:up && npm run start:all",
  "blockchain:node": "npx hardhat node",
  "blockchain:deploy": "npx hardhat run scripts/deploy.ts --network localhost",
  "blockchain:test": "npx hardhat test"
};

// Merge scripts
pkg.scripts = {
  ...pkg.scripts,
  ...newScripts
};

// Write back
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log('✅ package.json updated with new scripts!');
console.log('\nNew scripts added:');
Object.keys(newScripts).forEach(script => {
  console.log(`  - npm run ${script}`);
});
console.log('\n🚀 You can now run: npm run start:all');