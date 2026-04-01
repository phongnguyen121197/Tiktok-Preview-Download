/**
 * AI Service - Tích hợp Claude API để phân tích video và KOC
 * Sử dụng Anthropic Claude (Vision + Text) qua API key của người dùng
 */

import Anthropic from '@anthropic-ai/sdk';
import * as https from 'https';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface VideoAIAnalysis {
  contentCategory: string;          // Danh mục nội dung chính
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;            // 0-100
  topics: string[];                  // Chủ đề chính (3-5 items)
  hashtags: string[];                // Hashtag nổi bật phát hiện được
  viralityScore: number;             // Điểm viral 0-100
  targetAudience: string;            // Đối tượng mục tiêu
  contentStyle: string;              // Phong cách nội dung
  strengths: string[];               // Điểm mạnh của video
  recommendations: string[];         // Gợi ý cải thiện
  tiktokShopPotential: 'high' | 'medium' | 'low'; // Tiềm năng bán hàng
  summary: string;                   // Tóm tắt phân tích
}

export interface KOCAIAnalysis {
  overallScore: number;              // Điểm tổng 0-100
  recommendation: 'excellent' | 'good' | 'fair' | 'poor';
  conversionPotential: number;       // Tiềm năng chuyển đổi 0-100
  audienceQuality: number;           // Chất lượng khán giả 0-100
  contentConsistency: number;        // Độ nhất quán nội dung 0-100
  monetizationReady: boolean;
  strengths: string[];
  weaknesses: string[];
  tier: 'nano' | 'micro' | 'mid' | 'macro' | 'mega';
  reasoning: string;
  suggestions: string[];             // Gợi ý cho brand khi hợp tác
}

export interface VideoMetadataForAI {
  title: string;
  description: string;
  uploader: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  duration: number;
  thumbnail: string;
  uploadDate: string;
}

export interface KOCDataForAI {
  username: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  duration: number;
  videoTitle: string;
  videoDescription: string;
  uploadDate: string;
  // Có thể mở rộng thêm nếu lấy được từ FastMoss
  estimatedFollowers?: number;
  niche?: string;
}

// ─── Helper: Fetch thumbnail as base64 ────────────────────────────────────

async function fetchImageBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const request = https.get(url, { timeout: 8000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('base64'));
      });
      res.on('error', () => resolve(null));
    });
    request.on('error', () => resolve(null));
    request.on('timeout', () => { request.destroy(); resolve(null); });
  });
}

// ─── Main AI Service Class ─────────────────────────────────────────────────

export class AIService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Phân tích nội dung video TikTok
   * Dùng thumbnail (vision) + metadata để cho ra kết quả phân tích toàn diện
   */
  async analyzeVideoContent(metadata: VideoMetadataForAI): Promise<VideoAIAnalysis> {
    // Cố gắng fetch thumbnail để dùng vision
    const thumbnailBase64 = await fetchImageBase64(metadata.thumbnail);

    const engagementRate = metadata.viewCount > 0
      ? ((metadata.likeCount + metadata.commentCount) / metadata.viewCount * 100).toFixed(2)
      : '0';

    const prompt = `Bạn là chuyên gia phân tích nội dung TikTok và TikTok Shop. Hãy phân tích video TikTok này và trả về JSON.

THÔNG TIN VIDEO:
- Tiêu đề/Caption: ${metadata.title || metadata.description || '(không có)'}
- Creator: @${metadata.uploader}
- Lượt xem: ${metadata.viewCount.toLocaleString()}
- Lượt thích: ${metadata.likeCount.toLocaleString()}
- Bình luận: ${metadata.commentCount.toLocaleString()}
- Chia sẻ: ${metadata.shareCount.toLocaleString()}
- Thời lượng: ${Math.floor(metadata.duration / 60)}:${String(metadata.duration % 60).padStart(2, '0')}
- Tỷ lệ engagement: ${engagementRate}%
- Ngày đăng: ${metadata.uploadDate}

${thumbnailBase64 ? 'Hình thumbnail đính kèm bên trên để phân tích hình ảnh.' : '(Không có thumbnail)'}

Trả về JSON hợp lệ (KHÔNG có markdown, KHÔNG có backtick):
{
  "contentCategory": "Lifestyle/Beauty/Food/Fashion/Tech/Gaming/Education/Entertainment/...",
  "sentiment": "positive|negative|neutral",
  "sentimentScore": 0-100,
  "topics": ["topic1", "topic2", "topic3"],
  "hashtags": ["#tag1", "#tag2"],
  "viralityScore": 0-100,
  "targetAudience": "mô tả đối tượng mục tiêu",
  "contentStyle": "mô tả phong cách (ví dụ: Hài hước, Review sản phẩm, Tutorial...)",
  "strengths": ["điểm mạnh 1", "điểm mạnh 2"],
  "recommendations": ["gợi ý 1", "gợi ý 2"],
  "tiktokShopPotential": "high|medium|low",
  "summary": "1-2 câu tóm tắt phân tích bằng tiếng Việt"
}`;

    const messages: Anthropic.MessageParam[] = thumbnailBase64
      ? [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: thumbnailBase64 }
            },
            { type: 'text', text: prompt }
          ]
        }]
      : [{ role: 'user', content: prompt }];

    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as VideoAIAnalysis;
  }

  /**
   * Phân tích tiềm năng KOC dựa trên số liệu video
   */
  async analyzeKOC(data: KOCDataForAI): Promise<KOCAIAnalysis> {
    const engagementRate = data.viewCount > 0
      ? ((data.likeCount + data.commentCount) / data.viewCount * 100).toFixed(2)
      : '0';

    // Ước tính tier dựa trên view count (proxy cho followers)
    const estimatedFollowers = data.estimatedFollowers
      || Math.round(data.viewCount * 0.15); // rough estimate

    let tier = 'micro';
    if (estimatedFollowers < 10000) tier = 'nano';
    else if (estimatedFollowers < 100000) tier = 'micro';
    else if (estimatedFollowers < 500000) tier = 'mid';
    else if (estimatedFollowers < 1000000) tier = 'macro';
    else tier = 'mega';

    const prompt = `Bạn là chuyên gia phân tích KOC (Key Opinion Consumer) cho thị trường TikTok Việt Nam và TikTok Shop.

THÔNG TIN CREATOR:
- Username: @${data.username}
- Video: "${data.videoTitle || data.videoDescription?.slice(0, 100) || '(không có tiêu đề)'}"
- Lượt xem: ${data.viewCount.toLocaleString()}
- Lượt thích: ${data.likeCount.toLocaleString()}
- Bình luận: ${data.commentCount.toLocaleString()}
- Chia sẻ: ${data.shareCount.toLocaleString()}
- Tỷ lệ engagement: ${engagementRate}%
- Thời lượng video: ${data.duration}s
- Ước tính followers: ${estimatedFollowers.toLocaleString()}
- Tier ước tính: ${tier}
${data.niche ? `- Niche: ${data.niche}` : ''}

TIÊU CHÍ ĐÁNH GIÁ KOC:
- Engagement rate tốt: 3-8% (xuất sắc: >8%)
- Tỷ lệ comment/like tốt: >5% (cho thấy tương tác thật)
- Nano/Micro KOC (10K-100K) thường có engagement cao hơn
- Share rate cao cho thấy nội dung có giá trị lan truyền

Trả về JSON hợp lệ (KHÔNG có markdown):
{
  "overallScore": 0-100,
  "recommendation": "excellent|good|fair|poor",
  "conversionPotential": 0-100,
  "audienceQuality": 0-100,
  "contentConsistency": 0-100,
  "monetizationReady": true|false,
  "tier": "nano|micro|mid|macro|mega",
  "strengths": ["điểm mạnh 1", "điểm mạnh 2", "điểm mạnh 3"],
  "weaknesses": ["điểm yếu 1", "điểm yếu 2"],
  "reasoning": "1-2 câu nhận xét tổng quan bằng tiếng Việt",
  "suggestions": ["gợi ý cho brand khi hợp tác 1", "gợi ý 2"]
}`;

    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as KOCAIAnalysis;
  }
}

// ─── License Validation ────────────────────────────────────────────────────

/**
 * Validate license key bằng simple checksum
 * Format: TKTK-XXXX-XXXX-XXXX (16 ký tự alphanumeric + dấu gạch)
 */
export function validateLicenseKey(key: string): boolean {
  if (!key) return false;
  const normalized = key.toUpperCase().replace(/\s/g, '');
  // Format: TKTK-XXXXXXXX-XXXX
  const pattern = /^TKTK-[A-Z0-9]{8}-[A-Z0-9]{4}$/;
  if (!pattern.test(normalized)) return false;

  // Checksum: tổng char codes của 12 ký tự giữa phải chia hết cho 7
  const chars = normalized.replace(/-/g, '').slice(4); // 12 ký tự sau TKTK
  const sum = chars.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return sum % 7 === 0;
}

/**
 * Tạo license key hợp lệ (dùng để generate key cho khách hàng)
 * Chỉ dùng phía server/admin — không export ra client
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  // Thử cho đến khi sum % 7 === 0
  while (true) {
    const part1 = rand(8);
    const part2 = rand(4);
    const combined = part1 + part2;
    const sum = combined.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    if (sum % 7 === 0) {
      return `TKTK-${part1}-${part2}`;
    }
  }
}
