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
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return extractJSON(raw) as VideoAIAnalysis;
  }

  /**
   * Phân tích KOC toàn diện từ dữ liệu FastMoss đã scrape
   */
  async analyzeKOCFromFastMoss(scrapeData: any, computed: any): Promise<any> {
    const { overview, audience, sales, username } = scrapeData;

    // Rút gọn top videos để tránh token overflow
    const topVidsText = (sales.top_videos?.slice(0, 3) || [])
      .map((v: any, i: number) =>
        `${i + 1}. "${String(v.title || '').slice(0, 40)}" | DT: ${v.revenue || 'N/A'} | Views: ${v.views || 'N/A'}`
      ).join('\n') || '(không có dữ liệu)';

    const topCatsText = (sales.top_categories?.slice(0, 4) || [])
      .map((c: any) => `${c.name} ${c.percent}`).join(', ') || 'N/A';

    const prompt = `Bạn là chuyên gia phân tích KOC TikTok Shop Việt Nam. Phân tích @${username} từ dữ liệu FastMoss, trả về JSON ngắn gọn.

DỮ LIỆU:
GMV: ${overview.gmv_total || 'N/A'} | Video: ${overview.gmv_video || 'N/A'} | Live: ${overview.gmv_livestream || 'N/A'}
GPM 28 ngày: ${overview.gpm_video_28d || 'N/A'} | Videos: ${overview.total_videos || 'N/A'} (BH: ${overview.sales_videos || 'N/A'})
Tỷ lệ BH: ${computed.video_sales_ratio} | Est GMV/video: ${computed.est_gmv_per_video}
Shops: ${sales.partner_stores || 'N/A'} | Sản phẩm: ${sales.total_products || 'N/A'}
Ngành: ${topCatsText}
Top videos: ${topVidsText}
Khán giả: Nam ${audience.gender_male || 'N/A'} / Nữ ${audience.gender_female || 'N/A'}
Tuổi: 18-24: ${audience.age_18_24 || 'N/A'} | 25-34: ${audience.age_25_34 || 'N/A'} | 35+: ${audience.age_35_44 || 'N/A'}
ER TB: ${overview.avg_engagement_rate || 'N/A'} | Trung vị views: ${overview.median_views || 'N/A'}

Trả về JSON (KHÔNG markdown, KHÔNG backtick, giữ text NGẮN - tối đa 60 ký tự/string):
{"sales_capability":{"score":0,"summary":"text","ai_comment":"text","highlights":["h1","h2"]},"audience_quality":{"score":0,"summary":"text","ai_comment":"text","highlights":["h1","h2"]},"content_quality":{"score":0,"summary":"text","ai_comment":"text","highlights":["h1","h2"]},"brand_recommendation":{"overall_score":0,"tier":"nano","recommendation":"good","fit_categories":["cat1"],"content_strategy":["s1"],"suggestions":["s1","s2"],"risks":["r1"]}}`;

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return extractJSON(raw);
  }
}

// ─── JSON Extractor / Repair ───────────────────────────────────────────────
/**
 * Trích xuất JSON từ text AI trả về. Xử lý các trường hợp:
 * - Có markdown code block (```json ... ```)
 * - Có text thừa trước/sau JSON
 * - JSON bị truncate (thiếu closing brackets)
 */
function extractJSON(text: string): any {
  // 1. Xóa markdown code fences
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // 2. Tìm vị trí bắt đầu và kết thúc của JSON object
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error('Không tìm thấy JSON trong phản hồi AI');

  // Tìm closing bracket khớp với opening bracket đầu tiên
  let depth = 0;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  // 3. Nếu tìm được JSON hoàn chỉnh → parse trực tiếp
  if (end !== -1) {
    const jsonStr = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Tiếp tục sang repair
    }
  }

  // 4. JSON bị truncate → thêm closing brackets
  const partial = end !== -1 ? cleaned.slice(start, end + 1) : cleaned.slice(start);
  const repaired = repairTruncatedJSON(partial);
  try {
    return JSON.parse(repaired);
  } catch (e) {
    throw new Error(`Phản hồi AI không hợp lệ (JSON lỗi): ${(e as Error).message}`);
  }
}

/**
 * Thêm closing brackets/braces cho JSON bị cắt giữa chừng
 */
function repairTruncatedJSON(partial: string): string {
  let result = partial.trim();

  // Xóa trailing comma nếu có
  result = result.replace(/,\s*$/, '');

  // Đếm brackets mở chưa được đóng
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (const ch of result) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // Đóng string nếu đang mở
  if (inString) result += '"';

  // Đóng tất cả brackets còn mở (theo thứ tự ngược)
  while (stack.length > 0) {
    result += stack.pop();
  }

  return result;
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
