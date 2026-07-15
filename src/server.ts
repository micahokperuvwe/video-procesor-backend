import http from 'http';
import app from './app';
import { initSocket } from './socket/socket';

const PORT = process.env.PORT || 3000;

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start server listening
server.listen(PORT, () => {
  const isSupabase = process.env.SUPABASE_URL && 
                     process.env.SUPABASE_KEY && 
                     !process.env.SUPABASE_URL.includes('your-supabase-url') &&
                     process.env.USE_MOCK_SERVICES !== 'true';
  
  console.log(`===============================================`);
  console.log(`  VELOSTREAM - VIDEO PROCESSING PLATFORM`);
  console.log(`  Port: ${PORT}`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Database: ${isSupabase ? '✅ SUPABASE CONNECTED' : '⚠️  LOCAL JSON'}`);
  console.log(`  Realtime: ✅ Socket.io Active`);
  console.log(`===============================================`);
});
