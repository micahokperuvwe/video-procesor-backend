import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { dbService } from '../config/db';

let io: Server | null = null;

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for development ease
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join specific video room for tracking progress
    socket.on('join_video', (videoId: string) => {
      socket.join(`video_${videoId}`);
      console.log(`Socket ${socket.id} joined room: video_${videoId}`);
    });

    // Leave video room
    socket.on('leave_video', (videoId: string) => {
      socket.leave(`video_${videoId}`);
      console.log(`Socket ${socket.id} left room: video_${videoId}`);
    });

    // Join user specific room for notifications
    socket.on('join_user', (userId: string) => {
      socket.join(`user_${userId}`);
      console.log(`Socket ${socket.id} joined room: user_${userId}`);
    });

    // Leave user specific room
    socket.on('leave_user', (userId: string) => {
      socket.leave(`user_${userId}`);
      console.log(`Socket ${socket.id} left room: user_${userId}`);
    });

    // Join admin room for health metrics and logs
    socket.on('join_admin', () => {
      socket.join('admin_channel');
      console.log(`Socket ${socket.id} joined admin_channel`);
    });

    socket.on('leave_admin', () => {
      socket.leave('admin_channel');
      console.log(`Socket ${socket.id} left admin_channel`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Start periodic system health emission
  setInterval(async () => {
    if (io) {
      const cpuUsage = (Math.random() * 15 + 5).toFixed(1); // Simulated CPU usage 5-20%
      const freeMemPercent = (Math.random() * 10 + 65).toFixed(1); // Simulated Free Memory
      const totalMemBytes = 16 * 1024 * 1024 * 1024; // 16GB
      const activeJobs = await dbService.getActiveJobs();
      
      io.to('admin_channel').emit('system_health', {
        timestamp: new Date().toISOString(),
        cpu: parseFloat(cpuUsage),
        memory: parseFloat(freeMemPercent),
        totalMemBytes,
        activeJobsCount: activeJobs.length
      });
    }
  }, 3000);

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io not initialized. Please call initSocket first.');
  }
  return io;
};

// Global emission helpers
export const emitVideoProgress = (videoId: string, payload: {
  status: string;
  progress: number;
  error_message?: string | null;
  playback_url?: string | null;
  thumbnail_url?: string | null;
}) => {
  if (io) {
    io.to(`video_${videoId}`).emit('video_progress', payload);
    // Also notify admins of queue progress
    io.to('admin_channel').emit('queue_progress', { videoId, ...payload });
  }
};

export const emitNotification = (userId: string, notification: any) => {
  if (io) {
    io.to(`user_${userId}`).emit('new_notification', notification);
  }
};

export const emitSystemLog = (log: any) => {
  if (io) {
    io.to('admin_channel').emit('new_log', log);
  }
};
