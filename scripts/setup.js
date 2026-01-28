#!/usr/bin/env node

/**
 * Complete Platform Setup Script
 * Handles all initialization: environment, database, dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(message) {
  console.log('\n');
  log('═'.repeat(60), colors.cyan);
  log(`  ${message}`, colors.bright);
  log('═'.repeat(60), colors.cyan);
  console.log('\n');
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function exec(command, description) {
  try {
    info(`${description}...`);
    execSync(command, { stdio: 'inherit' });
    success(`${description} complete`);
    return true;
  } catch (err) {
    error(`${description} failed`);
    return false;
  }
}

async function checkPrerequisites() {
  header('Checking Prerequisites');

  const checks = [
    { cmd: 'node --version', name: 'Node.js', required: true },
    { cmd: 'npm --version', name: 'npm', required: true },
    { cmd: 'psql --version', name: 'PostgreSQL', required: true },
    { cmd: 'docker --version', name: 'Docker', required: false },
    { cmd: 'redis-cli --version', name: 'Redis', required: false },
  ];

  let allRequired = true;

  for (const check of checks) {
    try {
      const version = execSync(check.cmd, { encoding: 'utf8' }).trim();
      success(`${check.name}: ${version}`);
    } catch (err) {
      if (check.required) {
        error(`${check.name} not found (REQUIRED)`);
        allRequired = false;
      } else {
        warning(`${check.name} not found (optional)`);
      }
    }
  }

  if (!allRequired) {
    error('\nMissing required dependencies. Please install:');
    log('  - Node.js 18+: https://nodejs.org/', colors.yellow);
    log('  - PostgreSQL 15+: https://www.postgresql.org/download/', colors.yellow);
    process.exit(1);
  }

  success('\nAll required prerequisites met!');
}

function setupEnvironment() {
  header('Setting Up Environment');

  const envPath = path.join(__dirname, '..', '.env');
  const examplePath = path.join(__dirname, '..', '.env.example');

  if (fs.existsSync(envPath)) {
    warning('.env file already exists');
    info('Skipping environment setup');
    return;
  }

  if (!fs.existsSync(examplePath)) {
    error('.env.example not found!');
    process.exit(1);
  }

  fs.copyFileSync(examplePath, envPath);
  success('Created .env file from template');

  info('\n📝 Please edit .env file with your configuration:');
  log('   - Database credentials', colors.yellow);
  log('   - JWT secret (min 32 characters)', colors.yellow);
  log('   - Encryption key (32 characters)', colors.yellow);
  log('\n   Run: nano .env', colors.cyan);
}

function installDependencies() {
  header('Installing Dependencies');

  if (!exec('npm install', 'Installing npm packages')) {
    error('Failed to install dependencies');
    process.exit(1);
  }

  success('All dependencies installed');
}

function setupDatabase() {
  header('Setting Up Database');

  info('Checking database connection...');

  // Load environment
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    database: process.env.DB_NAME || 'metaverse_ads_dev',
    user: process.env.DB_USER || 'postgres',
  };

  info(`Connecting to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  try {
    // Try to connect and initialize
    execSync('node scripts/setup-database.js', { stdio: 'inherit' });
    success('Database initialized successfully');
  } catch (err) {
    error('Database setup failed');
    warning('\nTroubleshooting:');
    log('  1. Make sure PostgreSQL is running:', colors.yellow);
    log('     macOS: brew services start postgresql', colors.cyan);
    log('     Linux: sudo systemctl start postgresql', colors.cyan);
    log('     Windows: Start from Services', colors.cyan);
    log('\n  2. Check database credentials in .env', colors.yellow);
    log('\n  3. Create database manually:', colors.yellow);
    log(`     createdb ${dbConfig.database}`, colors.cyan);
    log('\n  4. Run setup again:', colors.yellow);
    log('     npm run setup:db', colors.cyan);
    process.exit(1);
  }
}

function displayNextSteps() {
  header('Setup Complete! 🎉');

  log('Your Metaverse Advertising Platform is ready!\n', colors.green);

  info('📍 Next Steps:\n');

  log('1. Start the platform:', colors.bright);
  log('   npm run start:all\n', colors.cyan);

  log('2. Access the application:', colors.bright);
  log('   Frontend: http://localhost:5173', colors.cyan);
  log('   API:      http://localhost:3001', colors.cyan);
  log('   Health:   http://localhost:3001/health\n', colors.cyan);

  log('3. Login with demo account:', colors.bright);
  log('   Email:    advertiser@demo.com', colors.cyan);
  log('   Password: password123\n', colors.cyan);

  log('4. Explore features:', colors.bright);
  log('   - Create advertising campaigns', colors.yellow);
  log('   - Lock funds in blockchain escrow', colors.yellow);
  log('   - View real-time analytics', colors.yellow);
  log('   - Track ad events\n', colors.yellow);

  info('📚 Documentation:');
  log('   - Quick Start: ./QUICKSTART.md', colors.cyan);
  log('   - Architecture: ./ARCHITECTURE.md', colors.cyan);
  log('   - API Docs:     ./BACKEND_README.md\n', colors.cyan);

  info('🐳 Docker Deployment:');
  log('   docker-compose up -d\n', colors.cyan);

  info('🧪 Run Tests:');
  log('   npm test\n', colors.cyan);

  info('🆘 Need Help?');
  log('   - Check QUICKSTART.md for troubleshooting', colors.cyan);
  log('   - Report issues on GitHub', colors.cyan);
  log('   - Join our Discord community\n', colors.cyan);

  log('═'.repeat(60), colors.cyan);
  log('  Happy Building! 🚀', colors.bright);
  log('═'.repeat(60), colors.cyan);
  console.log('\n');
}

async function main() {
  console.clear();

  log('\n╔═══════════════════════════════════════════════════════════╗', colors.cyan);
  log('║                                                           ║', colors.cyan);
  log('║   🌐 Metaverse Advertising Platform Setup               ║', colors.bright);
  log('║   Privacy-First, Blockchain-Powered Advertising          ║', colors.cyan);
  log('║                                                           ║', colors.cyan);
  log('╚═══════════════════════════════════════════════════════════╝', colors.cyan);
  console.log('\n');

  try {
    await checkPrerequisites();
    setupEnvironment();
    installDependencies();
    setupDatabase();
    displayNextSteps();
  } catch (err) {
    error('\n❌ Setup failed with error:');
    console.error(err);
    process.exit(1);
  }
}

// Run setup
main();
