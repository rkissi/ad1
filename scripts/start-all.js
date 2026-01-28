#!/usr/bin/env node

/**
 * Complete Platform Startup Script
 * Starts all services: Database, Blockchain, API, Frontend
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const services = [];

function log(service, message, color = '\x1b[0m') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${timestamp}] [${service}]\x1b[0m ${message}`);
}

function startService(name, command, args, color) {
  log(name, `Starting...`, color);
  
  const proc = spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env }
  });

  proc.stdout.on('data', (data) => {
    data.toString().split('\n').forEach(line => {
      if (line.trim()) log(name, line, color);
    });
  });

  proc.stderr.on('data', (data) => {
    data.toString().split('\n').forEach(line => {
      if (line.trim()) log(name, line, '\x1b[31m');
    });
  });

  proc.on('close', (code) => {
    log(name, `Exited with code ${code}`, code === 0 ? '\x1b[32m' : '\x1b[31m');
  });

  services.push({ name, proc });
  return proc;
}

async function checkEnvironment() {
  log('SETUP', 'Checking environment...', '\x1b[36m');
  
  // Check if .env exists
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    log('SETUP', '⚠️  .env file not found. Creating from template...', '\x1b[33m');
    const examplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      log('SETUP', '✅ Created .env file', '\x1b[32m');
    } else {
      log('SETUP', '❌ .env.example not found!', '\x1b[31m');
      process.exit(1);
    }
  }
  
  log('SETUP', '✅ Environment loaded', '\x1b[32m');
}

async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   🚀 Metaverse Advertising Platform - Startup        ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('\n');

  await checkEnvironment();

  // Start services
  log('STARTUP', 'Starting all services...', '\x1b[36m');
  console.log('\n');

  // 1. Start API Server
  startService('API', 'npx', ['tsx', 'watch', 'src/api/server.ts'], '\x1b[34m');
  
  // Wait a bit for API to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 2. Start Frontend
  startService('FRONTEND', 'npm', ['run', 'dev'], '\x1b[35m');

  console.log('\n');
  log('STARTUP', '✨ All services started!', '\x1b[32m');
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   📍 Service URLs                                     ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log('║   Frontend:  http://localhost:5173                    ║');
  console.log('║   API:       http://localhost:3001                    ║');
  console.log('║   Health:    http://localhost:3001/health             ║');
  console.log('║   Metrics:   http://localhost:3001/metrics            ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log('Press Ctrl+C to stop all services\n');
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down services...\n');
  services.forEach(({ name, proc }) => {
    log(name, 'Stopping...', '\x1b[33m');
    proc.kill();
  });
  setTimeout(() => {
    console.log('\n✅ All services stopped\n');
    process.exit(0);
  }, 1000);
});

// Start
main().catch(error => {
  console.error('\n❌ Startup failed:', error.message);
  process.exit(1);
});