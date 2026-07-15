import { dbService } from '../config/db';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  storage_limit_gb: number;
  processing_minutes: number;
  max_video_size_mb: number;
  max_videos: number | null;
  features: any;
  is_active: boolean;
}

class SubscriptionService {
  /**
   * Get all active subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const query = `
      SELECT * FROM subscription_plans
      WHERE is_active = true
      ORDER BY price ASC
    `;
    
    const { data, error } = await dbService.query(query);
    
    if (error) {
      console.error('[SUBSCRIPTION] Get plans error:', error);
      throw new Error('Failed to fetch subscription plans');
    }
    
    return data || [];
  }

  /**
   * Get plan by name
   */
  async getPlanByName(name: string): Promise<SubscriptionPlan | null> {
    const query = `
      SELECT * FROM subscription_plans
      WHERE name = $1 AND is_active = true
    `;
    
    const { data, error } = await dbService.query(query, [name]);
    
    if (error) {
      console.error('[SUBSCRIPTION] Get plan error:', error);
      throw new Error('Failed to fetch subscription plan');
    }
    
    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Check if user can perform action based on plan limits
   */
  async checkLimit(userId: string, limitType: 'storage' | 'processing' | 'videos' | 'video_size', value: number): Promise<{ allowed: boolean; message?: string }> {
    // Get user's current plan
    const subscription = await dbService.getSubscriptionByUserId(userId);
    
    if (!subscription) {
      return { allowed: false, message: 'No active subscription found' };
    }
    
    const plan = await this.getPlanByName(subscription.plan_name);
    
    if (!plan) {
      return { allowed: false, message: 'Invalid subscription plan' };
    }
    
    // Get current usage
    const usage = await this.getCurrentUsage(userId);
    
    // Check specific limit
    switch (limitType) {
      case 'storage':
        if (usage.storage_used_gb + value > plan.storage_limit_gb) {
          return {
            allowed: false,
            message: `Storage limit exceeded. Upgrade to increase your storage from ${plan.storage_limit_gb}GB.`
          };
        }
        break;
        
      case 'processing':
        if (usage.processing_minutes_used + value > plan.processing_minutes) {
          return {
            allowed: false,
            message: `Processing minutes limit exceeded. Upgrade to increase your processing minutes from ${plan.processing_minutes}.`
          };
        }
        break;
        
      case 'videos':
        if (plan.max_videos !== null && usage.videos_count >= plan.max_videos) {
          return {
            allowed: false,
            message: `Video limit reached (${plan.max_videos} videos). Upgrade for unlimited videos.`
          };
        }
        break;
        
      case 'video_size':
        const maxSizeGB = plan.max_video_size_mb / 1024;
        if (value > maxSizeGB) {
          return {
            allowed: false,
            message: `Video file too large. Maximum size for your plan is ${plan.max_video_size_mb}MB.`
          };
        }
        break;
    }
    
    return { allowed: true };
  }

  /**
   * Get current usage for user
   */
  async getCurrentUsage(userId: string) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const query = `
      SELECT * FROM usage_tracking
      WHERE user_id = $1
      AND period_start = $2
      AND period_end = $3
    `;
    
    const { data } = await dbService.query(query, [userId, periodStart, periodEnd]);
    
    if (data && data.length > 0) {
      return data[0];
    }
    
    // Create initial usage record
    const insertQuery = `
      INSERT INTO usage_tracking (user_id, period_start, period_end, storage_used_gb, processing_minutes_used, videos_count)
      VALUES ($1, $2, $3, 0, 0, 0)
      RETURNING *
    `;
    
    const { data: newData } = await dbService.query(insertQuery, [userId, periodStart, periodEnd]);
    
    return newData && newData.length > 0 ? newData[0] : {
      storage_used_gb: 0,
      processing_minutes_used: 0,
      videos_count: 0
    };
  }

  /**
   * Update usage
   */
  async updateUsage(userId: string, updates: {
    storage_used_gb?: number;
    processing_minutes_used?: number;
    videos_count?: number;
    bandwidth_used_gb?: number;
  }) {
    const usage = await this.getCurrentUsage(userId);
    
    const query = `
      UPDATE usage_tracking
      SET 
        storage_used_gb = COALESCE($1, storage_used_gb),
        processing_minutes_used = COALESCE($2, processing_minutes_used),
        videos_count = COALESCE($3, videos_count),
        bandwidth_used_gb = COALESCE($4, bandwidth_used_gb),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $5
      AND period_start = $6
      RETURNING *
    `;
    
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const { data, error } = await dbService.query(query, [
      updates.storage_used_gb !== undefined ? usage.storage_used_gb + updates.storage_used_gb : null,
      updates.processing_minutes_used !== undefined ? usage.processing_minutes_used + updates.processing_minutes_used : null,
      updates.videos_count !== undefined ? usage.videos_count + updates.videos_count : null,
      updates.bandwidth_used_gb !== undefined ? usage.bandwidth_used_gb + updates.bandwidth_used_gb : null,
      userId,
      periodStart
    ]);
    
    if (error) {
      console.error('[SUBSCRIPTION] Update usage error:', error);
      throw new Error('Failed to update usage');
    }
    
    return data && data.length > 0 ? data[0] : null;
  }
}

export const subscriptionService = new SubscriptionService();
