// Simple API Server Starter
// Runs the backend API server for development

import { ApiServer } from './server';

const server = new ApiServer();

console.log('🚀 Starting Metaverse Ads API Server...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔗 API URL: http://localhost:3001');

server.start().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});
