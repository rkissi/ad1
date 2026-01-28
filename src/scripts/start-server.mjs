#!/usr/bin/env node

// Simple script to start the API server for development
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Metaverse Advertising API Server...');
console.log('📍 Environment: Development');
console.log('🔧 Using tsx for TypeScript execution');

// Start the API server with tsx
const serverProcess = spawn('npx', ['tsx', 'watch', 'src/server/api-server.ts'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start API server:', error);
  process.exit(1);
});

serverProcess.on('close', (code) => {
  console.log(`🛑 API server exited with code ${code}`);
  process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down API server...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down API server...');
  serverProcess.kill('SIGTERM');
});