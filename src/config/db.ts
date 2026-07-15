import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const useMock = process.env.USE_MOCK_SERVICES === 'true' || !supabaseUrl || supabaseUrl.includes('your-supabase-url');

let supabase: any = null;

if (!useMock) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ SUPABASE CONNECTED - Using remote Supabase database');
    console.log(`   URL: ${supabaseUrl}`);
  } catch (error) {
    console.error('❌ SUPABASE CONNECTION FAILED - Falling back to local JSON database:', error);
  }
} else {
  console.log('⚠️  USING LOCAL JSON DATABASE - Supabase not configured');
  console.log('   Set SUPABASE_URL and SUPABASE_KEY in .env to use Supabase');
}

// Local Database File Setup
const DB_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Interface structures
export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  avatar: string | null;
  role: 'USER' | 'ADMIN';
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  user_id: string;
  title: string;
  description: string;
  original_video_url: string;
  thumbnail_url: string | null;
  playback_url: string | null;
  duration: number;
  size: number;
  status: 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'ENCODING' | 'GENERATING_THUMBNAIL' | 'UPLOADING_OUTPUT' | 'COMPLETED' | 'FAILED';
  bitmovin_encoding_id?: string | null;
  error_message?: string | null;
  processing_attempts?: number;
  last_processed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessingJob {
  id: string;
  video_id: string;
  status: string;
  progress: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Analytics {
  id: string;
  video_id: string;
  views: number;
  watch_time: number; // in seconds
  bandwidth: number; // in bytes
  plays: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  amount: number;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  start_date: string;
  end_date: string | null;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  action: string;
  details: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  device_name: string;
  ip_address: string;
  last_active_at: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  last_used: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details: string | null;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface EmailVerificationToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

interface LocalDB {
  users: User[];
  videos: Video[];
  processing_jobs: ProcessingJob[];
  analytics: Analytics[];
  notifications: Notification[];
  subscriptions: Subscription[];
  logs: SystemLog[];
  user_sessions: UserSession[];
  api_keys: ApiKey[];
  activity_logs: ActivityLog[];
}

// Default Seed Data
const getSeedData = (): LocalDB => {
  const adminId = 'd3b07384-d113-49d8-944c-3c35b5a2bf47';
  const userId = '11f71a06-a7ad-45c1-840e-568d76d498c1';
  const video1Id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const video2Id = '3c8e54ba-e054-47bb-a988-662f2541a77d';
  const video3Id = '2a7f5eb3-c6b2-4d2a-89a3-dfa312384a6c';

  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync('admin123', salt);
  const userPasswordHash = bcrypt.hashSync('user123', salt);

  const now = new Date().toISOString();
  const pastDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  return {
    users: [
      {
        id: adminId,
        first_name: 'Bitmovin',
        last_name: 'Admin',
        email: 'admin@bitmovin-platform.com',
        password_hash: adminPasswordHash,
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&h=100&q=80',
        role: 'ADMIN',
        email_verified: true,
        created_at: pastDate(30),
        updated_at: pastDate(30),
      },
      {
        id: userId,
        first_name: 'John',
        last_name: 'Doe',
        email: 'user@bitmovin-platform.com',
        password_hash: userPasswordHash,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80',
        role: 'USER',
        email_verified: true,
        created_at: pastDate(15),
        updated_at: pastDate(15),
      }
    ],
    videos: [
      {
        id: video1Id,
        user_id: userId,
        title: 'Demo Trailer - Big Buck Bunny',
        description: 'Simulated 1080p high bitrate adaptive streaming profile.',
        original_video_url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnail_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&h=340&q=80',
        playback_url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        duration: 596,
        size: 276134981,
        status: 'COMPLETED',
        created_at: pastDate(10),
        updated_at: pastDate(10),
      },
      {
        id: video2Id,
        user_id: userId,
        title: 'Sintel Animated Film',
        description: 'Multi-resolution HLS encoding job containing 4 levels (360p, 480p, 720p, 1080p).',
        original_video_url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        thumbnail_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&h=340&q=80',
        playback_url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        duration: 888,
        size: 342194883,
        status: 'COMPLETED',
        created_at: pastDate(5),
        updated_at: pastDate(5),
      },
      {
        id: video3Id,
        user_id: userId,
        title: 'Corrupted Stream Test',
        description: 'Testing video output failure simulation.',
        original_video_url: 'http://example.com/corrupt.mp4',
        thumbnail_url: null,
        playback_url: null,
        duration: 0,
        size: 154032,
        status: 'FAILED',
        created_at: pastDate(2),
        updated_at: pastDate(2),
      }
    ],
    processing_jobs: [
      {
        id: uuidv4(),
        video_id: video1Id,
        status: 'COMPLETED',
        progress: 100,
        started_at: pastDate(10),
        completed_at: pastDate(10),
        error_message: null,
        created_at: pastDate(10),
      },
      {
        id: uuidv4(),
        video_id: video2Id,
        status: 'COMPLETED',
        progress: 100,
        started_at: pastDate(5),
        completed_at: pastDate(5),
        error_message: null,
        created_at: pastDate(5),
      },
      {
        id: uuidv4(),
        video_id: video3Id,
        status: 'FAILED',
        progress: 45,
        started_at: pastDate(2),
        completed_at: pastDate(2),
        error_message: 'Bitmovin Encoding Error: Failed to extract audio track or codec was incompatible.',
        created_at: pastDate(2),
      }
    ],
    analytics: [
      {
        id: uuidv4(),
        video_id: video1Id,
        views: 1240,
        watch_time: 442900,
        bandwidth: 342416376440,
        plays: 1080,
        created_at: pastDate(9),
      },
      {
        id: uuidv4(),
        video_id: video2Id,
        views: 890,
        watch_time: 594920,
        bandwidth: 304553445870,
        plays: 750,
        created_at: pastDate(4),
      },
      {
        id: uuidv4(),
        video_id: video3Id,
        views: 0,
        watch_time: 0,
        bandwidth: 0,
        plays: 0,
        created_at: pastDate(2),
      }
    ],
    notifications: [
      {
        id: uuidv4(),
        user_id: userId,
        title: 'Video Encoding Completed',
        message: 'Your video "Demo Trailer - Big Buck Bunny" has been processed and is ready for playback.',
        is_read: false,
        created_at: pastDate(10),
      },
      {
        id: uuidv4(),
        user_id: userId,
        title: 'Video Encoding Failed',
        message: 'Your video "Corrupted Stream Test" failed during the encoding step.',
        is_read: true,
        created_at: pastDate(2),
      }
    ],
    subscriptions: [
      {
        id: uuidv4(),
        user_id: userId,
        plan_name: 'Professional',
        amount: 49,
        status: 'ACTIVE',
        start_date: pastDate(15),
        end_date: null,
      },
      {
        id: uuidv4(),
        user_id: adminId,
        plan_name: 'Enterprise',
        amount: 299,
        status: 'ACTIVE',
        start_date: pastDate(30),
        end_date: null,
      }
    ],
    logs: [
      {
        id: uuidv4(),
        timestamp: pastDate(10),
        level: 'INFO',
        action: 'QUEUE_INIT',
        details: 'Video processing queue listener initialized.',
      },
      {
        id: uuidv4(),
        timestamp: pastDate(10),
        level: 'INFO',
        action: 'JOB_COMPLETED',
        details: `Encoding job completed for video ID: ${video1Id}`,
      },
      {
        id: uuidv4(),
        timestamp: pastDate(2),
        level: 'ERROR',
        action: 'JOB_FAILED',
        details: `Encoding job failed for video ID: ${video3Id}. Reason: Bitmovin codec failure.`,
      }
    ],
    user_sessions: [],
    api_keys: [],
    activity_logs: []
  };
};

// JSON database file helpers
const readDB = (): LocalDB => {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const data = getSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return data;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading JSON DB file, seeding new file:', error);
    const data = getSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return data;
  }
};

const writeDB = (data: LocalDB) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to JSON DB file:', error);
  }
};

// Database Service Interface
export const dbService = {
  // --- USERS ---
  async getUsers(): Promise<User[]> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return data;
    }
    return readDB().users;
  },

  async getUserByEmail(email: string): Promise<User | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
    const db = readDB();
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async getUserById(id: string): Promise<User | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
    const db = readDB();
    return db.users.find(u => u.id === id) || null;
  },

  async createUser(userData: Partial<User>): Promise<User> {
    const newUser: User = {
      id: userData.id || uuidv4(),
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      email: userData.email || '',
      password_hash: userData.password_hash || '',
      avatar: userData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80',
      role: userData.role || 'USER',
      email_verified: userData.email_verified || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!useMock && supabase) {
      const { data, error } = await supabase.from('users').insert([newUser]).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    db.users.push(newUser);
    writeDB(db);
    return newUser;
  },

  async updateUser(id: string, updateData: Partial<User>): Promise<User | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('users').update({ ...updateData, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return null;

    db.users[idx] = {
      ...db.users[idx],
      ...updateData,
      updated_at: new Date().toISOString()
    };
    writeDB(db);
    return db.users[idx];
  },

  async deleteUser(id: string): Promise<boolean> {
    if (!useMock && supabase) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const db = readDB();
    const initialLen = db.users.length;
    db.users = db.users.filter(u => u.id !== id);
    writeDB(db);
    return db.users.length < initialLen;
  },

  // --- VIDEOS ---
  async getVideos(userId?: string): Promise<Video[]> {
    if (!useMock && supabase) {
      let query = supabase.from('videos').select('*');
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    const db = readDB();
    let videos = db.videos;
    if (userId) {
      videos = videos.filter(v => v.user_id === userId);
    }
    return videos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getVideoById(id: string): Promise<Video | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('videos').select('*').eq('id', id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
    const db = readDB();
    return db.videos.find(v => v.id === id) || null;
  },

  async createVideo(videoData: Partial<Video>): Promise<Video> {
    const newVideo: Video = {
      id: videoData.id || uuidv4(),
      user_id: videoData.user_id || '',
      title: videoData.title || 'Untitled Video',
      description: videoData.description || '',
      original_video_url: videoData.original_video_url || '',
      thumbnail_url: videoData.thumbnail_url || null,
      playback_url: videoData.playback_url || null,
      duration: videoData.duration || 0,
      size: videoData.size || 0,
      status: videoData.status || 'UPLOADED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!useMock && supabase) {
      const { data, error } = await supabase.from('videos').insert([newVideo]).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    db.videos.push(newVideo);
    writeDB(db);
    return newVideo;
  },

  async updateVideo(id: string, updateData: Partial<Video>): Promise<Video | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('videos').update({ ...updateData, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    const idx = db.videos.findIndex(v => v.id === id);
    if (idx === -1) return null;

    db.videos[idx] = {
      ...db.videos[idx],
      ...updateData,
      updated_at: new Date().toISOString()
    };
    writeDB(db);
    return db.videos[idx];
  },

  async deleteVideo(id: string): Promise<boolean> {
    if (!useMock && supabase) {
      const { error } = await supabase.from('videos').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const db = readDB();
    const initialLen = db.videos.length;
    db.videos = db.videos.filter(v => v.id !== id);
    // clean up related analytics and jobs
    db.processing_jobs = db.processing_jobs.filter(j => j.video_id !== id);
    db.analytics = db.analytics.filter(a => a.video_id !== id);
    writeDB(db);
    return db.videos.length < initialLen;
  },

  // --- PROCESSING JOBS ---
  async getProcessingJobByVideoId(videoId: string): Promise<ProcessingJob | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('processing_jobs').select('*').eq('video_id', videoId).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
    const db = readDB();
    return db.processing_jobs.find(j => j.video_id === videoId) || null;
  },

  async createProcessingJob(jobData: Partial<ProcessingJob>): Promise<ProcessingJob> {
    const newJob: ProcessingJob = {
      id: jobData.id || uuidv4(),
      video_id: jobData.video_id || '',
      status: jobData.status || 'QUEUED',
      progress: jobData.progress || 0,
      started_at: jobData.started_at || null,
      completed_at: jobData.completed_at || null,
      error_message: jobData.error_message || null,
      created_at: new Date().toISOString(),
    };

    if (!useMock && supabase) {
      const { data, error } = await supabase.from('processing_jobs').insert([newJob]).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    db.processing_jobs.push(newJob);
    writeDB(db);
    return newJob;
  },

  async updateProcessingJob(id: string, updateData: Partial<ProcessingJob>): Promise<ProcessingJob | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('processing_jobs').update(updateData).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    const idx = db.processing_jobs.findIndex(j => j.id === id);
    if (idx === -1) return null;

    db.processing_jobs[idx] = {
      ...db.processing_jobs[idx],
      ...updateData
    };
    writeDB(db);
    return db.processing_jobs[idx];
  },

  async getActiveJobs(): Promise<ProcessingJob[]> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('processing_jobs').select('*').not('status', 'in', '("COMPLETED","FAILED")');
      if (error) throw error;
      return data;
    }
    return readDB().processing_jobs.filter(j => j.status !== 'COMPLETED' && j.status !== 'FAILED');
  },

  async getAllJobs(): Promise<ProcessingJob[]> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('processing_jobs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    return readDB().processing_jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // --- ANALYTICS ---
  async getAnalytics(videoId?: string): Promise<Analytics[]> {
    if (!useMock && supabase) {
      let query = supabase.from('analytics').select('*');
      if (videoId) {
        query = query.eq('video_id', videoId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
    const db = readDB();
    if (videoId) {
      return db.analytics.filter(a => a.video_id === videoId);
    }
    return db.analytics;
  },

  async createAnalytics(analyticsData: Partial<Analytics>): Promise<Analytics> {
    const newAnalytics: Analytics = {
      id: analyticsData.id || uuidv4(),
      video_id: analyticsData.video_id || '',
      views: analyticsData.views || 0,
      watch_time: analyticsData.watch_time || 0,
      bandwidth: analyticsData.bandwidth || 0,
      plays: analyticsData.plays || 0,
      created_at: new Date().toISOString(),
    };

    if (!useMock && supabase) {
      const { data, error } = await supabase.from('analytics').insert([newAnalytics]).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    db.analytics.push(newAnalytics);
    writeDB(db);
    return newAnalytics;
  },

  async updateVideoAnalytics(videoId: string, fields: { views?: number; watch_time?: number; bandwidth?: number; plays?: number }): Promise<Analytics> {
    const db = readDB();
    let analyticsItem = db.analytics.find(a => a.video_id === videoId);

    if (!analyticsItem) {
      analyticsItem = await this.createAnalytics({ video_id: videoId });
    }

    const updatedFields = {
      views: (analyticsItem.views || 0) + (fields.views || 0),
      watch_time: (analyticsItem.watch_time || 0) + (fields.watch_time || 0),
      bandwidth: (analyticsItem.bandwidth || 0) + (fields.bandwidth || 0),
      plays: (analyticsItem.plays || 0) + (fields.plays || 0),
    };

    if (!useMock && supabase) {
      const { data, error } = await supabase.from('analytics').update(updatedFields).eq('video_id', videoId).select().single();
      if (error) throw error;
      return data;
    }

    const idx = db.analytics.findIndex(a => a.video_id === videoId);
    db.analytics[idx] = {
      ...db.analytics[idx],
      ...updatedFields
    };
    writeDB(db);
    return db.analytics[idx];
  },

  async getPlatformAnalytics() {
    const db = readDB();
    const videos = db.videos;
    const users = db.users;
    const jobs = db.processing_jobs;
    const analytics = db.analytics;

    const totalUsers = users.length;
    const totalVideos = videos.length;
    const activeJobs = jobs.filter(j => j.status !== 'COMPLETED' && j.status !== 'FAILED').length;
    const failedJobs = jobs.filter(j => j.status === 'FAILED').length;

    let totalViews = 0;
    let totalWatchTime = 0;
    let totalBandwidth = 0;
    let totalPlays = 0;

    analytics.forEach(a => {
      totalViews += a.views || 0;
      totalWatchTime += a.watch_time || 0;
      totalBandwidth += a.bandwidth || 0;
      totalPlays += a.plays || 0;
    });

    const activeSubscriptions = db.subscriptions.filter(s => s.status === 'ACTIVE');
    const totalRevenue = activeSubscriptions.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return {
      totalUsers,
      totalVideos,
      activeJobs,
      failedJobs,
      totalViews,
      totalWatchTime,
      totalBandwidth,
      totalPlays,
      totalRevenue,
      storageUsed: videos.reduce((acc, curr) => acc + (curr.size || 0), 0),
      bandwidthUsed: totalBandwidth
    };
  },

  // --- NOTIFICATIONS ---
  async getNotifications(userId: string): Promise<Notification[]> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    const db = readDB();
    return db.notifications.filter(n => n.user_id === userId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createNotification(notifData: Partial<Notification>): Promise<Notification> {
    const newNotif: Notification = {
      id: uuidv4(),
      user_id: notifData.user_id || '',
      title: notifData.title || '',
      message: notifData.message || '',
      is_read: false,
      created_at: new Date().toISOString(),
    };

    if (!useMock && supabase) {
      const { data, error } = await supabase.from('notifications').insert([newNotif]).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    db.notifications.push(newNotif);
    writeDB(db);
    return newNotif;
  },

  async markNotificationsAsRead(userId: string): Promise<boolean> {
    if (!useMock && supabase) {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
      if (error) throw error;
      return true;
    }
    const db = readDB();
    db.notifications = db.notifications.map(n => {
      if (n.user_id === userId) {
        return { ...n, is_read: true };
      }
      return n;
    });
    writeDB(db);
    return true;
  },

  async deleteNotification(id: string): Promise<boolean> {
    if (!useMock && supabase) {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const db = readDB();
    const initialLen = db.notifications.length;
    db.notifications = db.notifications.filter(n => n.id !== id);
    writeDB(db);
    return db.notifications.length < initialLen;
  },

  async markSingleNotificationRead(id: string, userId: string): Promise<boolean> {
    if (!useMock && supabase) {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return true;
    }
    const db = readDB();
    const idx = db.notifications.findIndex(n => n.id === id && n.user_id === userId);
    if (idx === -1) return false;
    db.notifications[idx] = { ...db.notifications[idx], is_read: true };
    writeDB(db);
    return true;
  },

  // --- SUBSCRIPTIONS ---
  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id', userId).eq('status', 'ACTIVE').single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
    const db = readDB();
    return db.subscriptions.find(s => s.user_id === userId && s.status === 'ACTIVE') || null;
  },

  async getAllSubscriptions(): Promise<Subscription[]> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('subscriptions').select('*');
      if (error) throw error;
      return data;
    }
    return readDB().subscriptions;
  },

  async createSubscription(subData: Partial<Subscription>): Promise<Subscription> {
    const newSub: Subscription = {
      id: uuidv4(),
      user_id: subData.user_id || '',
      plan_name: subData.plan_name || 'Free',
      amount: subData.amount || 0,
      status: 'ACTIVE',
      start_date: new Date().toISOString(),
      end_date: subData.end_date || null,
    };

    if (!useMock && supabase) {
      const { data, error } = await supabase.from('subscriptions').insert([newSub]).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    // Cancel any current subscription
    db.subscriptions = db.subscriptions.map(s => {
      if (s.user_id === newSub.user_id && s.status === 'ACTIVE') {
        return { ...s, status: 'CANCELLED', end_date: new Date().toISOString() };
      }
      return s;
    });

    db.subscriptions.push(newSub);
    writeDB(db);
    return newSub;
  },

  async updateSubscription(userId: string, planName: string, amount: number): Promise<Subscription> {
    return this.createSubscription({ user_id: userId, plan_name: planName, amount });
  },

  // --- SYSTEM LOGS ---
  async getLogs(): Promise<SystemLog[]> {
    return readDB().logs;
  },

  async addLog(action: string, details: string, level: 'INFO' | 'WARNING' | 'ERROR' = 'INFO'): Promise<SystemLog> {
    const newLog: SystemLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      action,
      details,
    };

    if (!useMock && supabase) {
      const { error } = await supabase.from('system_logs').insert([{
        id: newLog.id,
        created_at: newLog.timestamp,
        level: newLog.level,
        action: newLog.action,
        details: newLog.details
      }]);
      if (error) {
        console.error('Failed to write system log to Supabase:', error);
      }
      return newLog;
    }

    const db = readDB();
    db.logs.push(newLog);
    // Keep logs size capped at 200
    if (db.logs.length > 200) {
      db.logs.shift();
    }
    writeDB(db);
    return newLog;
  },

  // --- VIDEO ANALYTICS (Enhanced) ---
  async recordVideoView(viewData: { video_id: string; user_id: string | null; watch_duration: number; completed: boolean }): Promise<void> {
    if (!useMock && supabase) {
      const { error } = await supabase.from('video_views').insert([{
        video_id: viewData.video_id,
        user_id: viewData.user_id,
        watch_duration: viewData.watch_duration,
        completed: viewData.completed,
        created_at: new Date().toISOString()
      }]);
      if (error) throw error;
    }
    // For local DB, we'll skip individual view records and just update aggregates
  },

  async updateVideoAnalyticsEnhanced(videoId: string): Promise<void> {
    if (!useMock && supabase) {
      // Get all views for this video
      const { data: views, error: viewsError } = await supabase
        .from('video_views')
        .select('*')
        .eq('video_id', videoId);

      if (viewsError) throw viewsError;

      if (!views || views.length === 0) return;

      // Calculate aggregates
      const viewCount = views.length;
      const totalWatchTime = views.reduce((sum: number, v: any) => sum + (v.watch_duration || 0), 0);
      const uniqueViewers = new Set(views.filter((v: any) => v.user_id).map((v: any) => v.user_id)).size;

      // Get video duration to calculate average watch percentage
      const video = await this.getVideoById(videoId);
      const videoDuration = video?.duration || 1;
      const averageWatchPercentage = videoDuration > 0 
        ? Math.min(100, (totalWatchTime / viewCount / videoDuration) * 100)
        : 0;

      const lastViewedAt = views[views.length - 1]?.created_at || new Date().toISOString();

      // Upsert analytics
      const { error: upsertError } = await supabase
        .from('video_analytics')
        .upsert({
          video_id: videoId,
          view_count: viewCount,
          total_watch_time: totalWatchTime,
          average_watch_percentage: averageWatchPercentage,
          unique_viewers: uniqueViewers,
          last_viewed_at: lastViewedAt,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'video_id'
        });

      if (upsertError) throw upsertError;
    }
    // For local DB, we'll use the existing analytics table
  },

  async getVideoAnalytics(videoId: string): Promise<any> {
    if (!useMock && supabase) {
      const { data, error } = await supabase
        .from('video_analytics')
        .select('*')
        .eq('video_id', videoId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || {
        video_id: videoId,
        view_count: 0,
        total_watch_time: 0,
        unique_viewers: 0,
        plays: 0,
        last_viewed_at: null
      };
    }

    // For local DB, return from existing analytics table
    const db = readDB();
    const analytics = db.analytics.find(a => a.video_id === videoId);
    if (analytics) {
      return {
        video_id: videoId,
        view_count: analytics.views || 0,
        total_watch_time: analytics.watch_time || 0,
        unique_viewers: 0,
        plays: analytics.plays || 0,
        last_viewed_at: null
      };
    }
    return {
      video_id: videoId,
      view_count: 0,
      total_watch_time: 0,
      unique_viewers: 0,
      plays: 0,
      last_viewed_at: null
    };
  },

  async getDailyViews(videoId: string, days: number = 7): Promise<Array<{ date: string; count: number }>> {
    if (!useMock && supabase) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('video_views')
        .select('created_at')
        .eq('video_id', videoId)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Group by date
      const viewsByDate: { [key: string]: number } = {};
      
      // Initialize all dates with 0
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        viewsByDate[dateStr] = 0;
      }

      // Count views per date
      if (data) {
        data.forEach((view: any) => {
          const dateStr = view.created_at.split('T')[0];
          viewsByDate[dateStr] = (viewsByDate[dateStr] || 0) + 1;
        });
      }

      // Convert to array and sort by date
      return Object.entries(viewsByDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // For local DB, return mock data
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      result.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 50)
      });
    }
    return result;
  },

  // --- USER SESSIONS ---
  async createSession(sessionData: Partial<UserSession>): Promise<UserSession> {
    const newSession: UserSession = {
      id: sessionData.id || uuidv4(),
      user_id: sessionData.user_id || '',
      device_name: sessionData.device_name || 'Unknown Device',
      ip_address: sessionData.ip_address || '127.0.0.1',
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    if (!useMock && supabase) {
      const { data, error } = await supabase.from('user_sessions').insert([newSession]).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    db.user_sessions = db.user_sessions || [];
    db.user_sessions.push(newSession);
    writeDB(db);
    return newSession;
  },

  async getSessions(userId: string): Promise<UserSession[]> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('user_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    const db = readDB();
    db.user_sessions = db.user_sessions || [];
    return db.user_sessions.filter(s => s.user_id === userId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getSessionById(id: string): Promise<UserSession | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('user_sessions').select('*').eq('id', id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
    const db = readDB();
    db.user_sessions = db.user_sessions || [];
    return db.user_sessions.find(s => s.id === id) || null;
  },

  async deleteSession(id: string): Promise<boolean> {
    if (!useMock && supabase) {
      const { error } = await supabase.from('user_sessions').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const db = readDB();
    db.user_sessions = db.user_sessions || [];
    const initialLen = db.user_sessions.length;
    db.user_sessions = db.user_sessions.filter(s => s.id !== id);
    writeDB(db);
    return db.user_sessions.length < initialLen;
  },

  async deleteOtherSessions(userId: string, currentSessionId: string): Promise<boolean> {
    if (!useMock && supabase) {
      const { error } = await supabase.from('user_sessions').delete().eq('user_id', userId).not('id', 'eq', currentSessionId);
      if (error) throw error;
      return true;
    }
    const db = readDB();
    db.user_sessions = db.user_sessions || [];
    const initialLen = db.user_sessions.length;
    db.user_sessions = db.user_sessions.filter(s => s.user_id !== userId || s.id === currentSessionId);
    writeDB(db);
    return db.user_sessions.length < initialLen;
  },

  async deleteAllSessions(userId: string): Promise<boolean> {
    if (!useMock && supabase) {
      const { error } = await supabase.from('user_sessions').delete().eq('user_id', userId);
      if (error) throw error;
      return true;
    }
    const db = readDB();
    db.user_sessions = db.user_sessions || [];
    const initialLen = db.user_sessions.length;
    db.user_sessions = db.user_sessions.filter(s => s.user_id !== userId);
    writeDB(db);
    return db.user_sessions.length < initialLen;
  },

  async updateSessionActivity(id: string): Promise<void> {
    const now = new Date().toISOString();
    if (!useMock && supabase) {
      await supabase.from('user_sessions').update({ last_active_at: now }).eq('id', id);
      return;
    }
    const db = readDB();
    db.user_sessions = db.user_sessions || [];
    const idx = db.user_sessions.findIndex(s => s.id === id);
    if (idx !== -1) {
      db.user_sessions[idx].last_active_at = now;
      writeDB(db);
    }
  },

  // --- API KEYS ---
  async createApiKey(keyData: Partial<ApiKey>): Promise<ApiKey> {
    const newKey: ApiKey = {
      id: keyData.id || uuidv4(),
      user_id: keyData.user_id || '',
      name: keyData.name || 'Unnamed Key',
      key_hash: keyData.key_hash || '',
      last_used: null,
      created_at: new Date().toISOString(),
    };

    if (!useMock && supabase) {
      const { data, error } = await supabase.from('api_keys').insert([newKey]).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    db.api_keys = db.api_keys || [];
    db.api_keys.push(newKey);
    writeDB(db);
    return newKey;
  },

  async getApiKeys(userId: string): Promise<ApiKey[]> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('api_keys').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    const db = readDB();
    db.api_keys = db.api_keys || [];
    return db.api_keys.filter(k => k.user_id === userId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getApiKeyById(id: string): Promise<ApiKey | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('api_keys').select('*').eq('id', id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
    const db = readDB();
    db.api_keys = db.api_keys || [];
    return db.api_keys.find(k => k.id === id) || null;
  },

  async deleteApiKey(id: string): Promise<boolean> {
    if (!useMock && supabase) {
      const { error } = await supabase.from('api_keys').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const db = readDB();
    db.api_keys = db.api_keys || [];
    const initialLen = db.api_keys.length;
    db.api_keys = db.api_keys.filter(k => k.id !== id);
    writeDB(db);
    return db.api_keys.length < initialLen;
  },

  async updateApiKeyLastUsed(id: string): Promise<void> {
    const now = new Date().toISOString();
    if (!useMock && supabase) {
      await supabase.from('api_keys').update({ last_used: now }).eq('id', id);
      return;
    }
    const db = readDB();
    db.api_keys = db.api_keys || [];
    const idx = db.api_keys.findIndex(k => k.id === id);
    if (idx !== -1) {
      db.api_keys[idx].last_used = now;
      writeDB(db);
    }
  },

  async getApiKeyByHash(hash: string): Promise<ApiKey | null> {
    if (!useMock && supabase) {
      const { data, error } = await supabase.from('api_keys').select('*').eq('key_hash', hash).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    }
    const db = readDB();
    db.api_keys = db.api_keys || [];
    return db.api_keys.find(k => k.key_hash === hash) || null;
  },

  // --- ACTIVITY LOGS ---
  async addActivityLog(logData: Partial<ActivityLog>): Promise<ActivityLog> {
    const newLog: ActivityLog = {
      id: logData.id || uuidv4(),
      user_id: logData.user_id || '',
      action: logData.action || 'UNKNOWN_ACTION',
      details: logData.details || null,
      ip_address: logData.ip_address || '127.0.0.1',
      user_agent: logData.user_agent || 'Unknown Agent',
      created_at: new Date().toISOString(),
    };

    if (!useMock && supabase) {
      const { data, error } = await supabase.from('activity_logs').insert([newLog]).select().single();
      if (error) throw error;
      return data;
    }

    const db = readDB();
    db.activity_logs = db.activity_logs || [];
    db.activity_logs.push(newLog);
    // cap at 1000 logs locally
    if (db.activity_logs.length > 1000) {
      db.activity_logs.shift();
    }
    writeDB(db);
    return newLog;
  },

  async getActivityLogs(userId: string, limit: number = 10, offset: number = 0): Promise<{ logs: ActivityLog[], total: number }> {
    if (!useMock && supabase) {
      const { data, count, error } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return { logs: data || [], total: count || 0 };
    }
    const db = readDB();
    db.activity_logs = db.activity_logs || [];
    const filtered = db.activity_logs.filter(l => l.user_id === userId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const paginated = filtered.slice(offset, offset + limit);
    return { logs: paginated, total: filtered.length };
  },

  // Raw query fallback method for custom queries (e.g. from subscription service)
  async query(queryString: string, params: any[] = []): Promise<{ data: any; error: any }> {
    if (!useMock && supabase) {
      // In production/supabase mode, use RPC or execute query. Since it is dynamic, let's parse a basic select/insert/update/delete.
      try {
        // Since we are mocking or using direct queries, we can handle it dynamically using Supabase client
        // For standard tables: usage_tracking, subscription_plans
        const match = queryString.trim().match(/^(SELECT|INSERT|UPDATE)\s+.*?\s+(?:FROM|INTO|SET)\s+(\w+)/i);
        if (match) {
          const action = match[1].toUpperCase();
          const table = match[2].toLowerCase();

          if (action === 'SELECT') {
            let queryBuilder = supabase.from(table).select('*');
            if (queryString.toLowerCase().includes('is_active = true') && table === 'subscription_plans') {
              queryBuilder = queryBuilder.eq('is_active', true);
            }
            if (queryString.toLowerCase().includes('name = $1')) {
              queryBuilder = queryBuilder.eq('name', params[0]);
            }
            if (queryString.toLowerCase().includes('user_id = $1')) {
              queryBuilder = queryBuilder.eq('user_id', params[0]);
            }
            const { data, error } = await queryBuilder;
            return { data, error };
          }
          if (action === 'INSERT') {
            // Very specific insert mapping for usage_tracking
            if (table === 'usage_tracking') {
              const { data, error } = await supabase.from(table).insert([{
                user_id: params[0],
                period_start: params[1],
                period_end: params[2],
                storage_used_gb: 0,
                processing_minutes_used: 0,
                videos_count: 0
              }]).select();
              return { data, error };
            }
          }
          if (action === 'UPDATE') {
            if (table === 'usage_tracking') {
              const { data, error } = await supabase.from(table).update({
                storage_used_gb: params[0],
                processing_minutes_used: params[1],
                videos_count: params[2],
                bandwidth_used_gb: params[3],
                updated_at: new Date().toISOString()
              }).eq('user_id', params[4]).select();
              return { data, error };
            }
          }
        }
        return { data: [], error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    }

    // Mock local storage mode implementation of custom SQL queries
    const db = readDB() as any;
    db.usage_tracking = db.usage_tracking || [];
    db.subscription_plans = db.subscription_plans || [
      { id: '1', name: 'Free', display_name: 'Free Starter', description: 'Basic upload & playback', price: 0, currency: 'USD', interval: 'month', storage_limit_gb: 5, processing_minutes: 30, max_video_size_mb: 500, max_videos: 5, features: {}, is_active: true },
      { id: '2', name: 'Professional', display_name: 'Professional', description: 'Advanced tools & settings', price: 49, currency: 'USD', interval: 'month', storage_limit_gb: 100, processing_minutes: 500, max_video_size_mb: 5120, max_videos: null, features: {}, is_active: true },
      { id: '3', name: 'Enterprise', display_name: 'Enterprise', description: 'Dedicated volume scaling', price: 299, currency: 'USD', interval: 'month', storage_limit_gb: 1000, processing_minutes: 5000, max_video_size_mb: 20480, max_videos: null, features: {}, is_active: true }
    ];

    try {
      const match = queryString.trim().match(/^(SELECT|INSERT|UPDATE)\s+.*?\s+(?:FROM|INTO|SET)\s+(\w+)/i);
      if (match) {
        const action = match[1].toUpperCase();
        const table = match[2].toLowerCase();

        if (action === 'SELECT') {
          let list = db[table] || [];
          if (table === 'subscription_plans') {
            list = list.filter((p: any) => p.is_active);
            if (queryString.toLowerCase().includes('name = $1')) {
              list = list.filter((p: any) => p.name === params[0]);
            }
          } else if (table === 'usage_tracking') {
            const userId = params[0];
            list = list.filter((u: any) => u.user_id === userId);
          }
          return { data: list, error: null };
        }
        if (action === 'INSERT') {
          if (table === 'usage_tracking') {
            const newRecord = {
              id: uuidv4(),
              user_id: params[0],
              period_start: params[1] instanceof Date ? params[1].toISOString() : params[1],
              period_end: params[2] instanceof Date ? params[2].toISOString() : params[2],
              storage_used_gb: 0,
              processing_minutes_used: 0,
              videos_count: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            db.usage_tracking.push(newRecord);
            writeDB(db);
            return { data: [newRecord], error: null };
          }
        }
        if (action === 'UPDATE') {
          if (table === 'usage_tracking') {
            const userId = params[4];
            const idx = db.usage_tracking.findIndex((u: any) => u.user_id === userId);
            if (idx !== -1) {
              db.usage_tracking[idx] = {
                ...db.usage_tracking[idx],
                storage_used_gb: params[0] !== null ? params[0] : db.usage_tracking[idx].storage_used_gb,
                processing_minutes_used: params[1] !== null ? params[1] : db.usage_tracking[idx].processing_minutes_used,
                videos_count: params[2] !== null ? params[2] : db.usage_tracking[idx].videos_count,
                bandwidth_used_gb: params[3] !== null ? params[3] : db.usage_tracking[idx].bandwidth_used_gb,
                updated_at: new Date().toISOString()
              };
              writeDB(db);
              return { data: [db.usage_tracking[idx]], error: null };
            }
          }
        }
      }
      return { data: [], error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }
};
