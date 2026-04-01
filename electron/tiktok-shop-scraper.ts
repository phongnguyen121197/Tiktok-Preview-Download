/**
 * 🛒 TikTok Shop Product Scraper
 * Lấy thông tin sản phẩm từ video TikTok có gắn giỏ hàng
 * 
 * Cách hoạt động:
 * 1. Dùng BrowserView với Mobile User-Agent để load video page
 * 2. Extract data từ SIGI_STATE (SSR data) hoặc intercept API
 * 3. Tìm anchor có anchor_type chứa SHOP/EC/PRODUCT
 * 4. Return product info: title, shop, sold_count
 */

import { BrowserWindow, BrowserView, session } from 'electron';
import { createLogger, format, transports } from 'winston';
import { join } from 'path';
import { app } from 'electron';

// Logger
const logsDir = join(app.getPath('userData'), 'logs');
const today = new Date().toISOString().split('T')[0];
const shopLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [SHOP] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: join(logsDir, `shop-${today}.log`) })
  ]
});

// Mobile User-Agent (iOS TikTok - important for showing product)
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Product info interface
export interface ProductInfo {
  hasProduct: boolean;
  productId?: string;
  productTitle?: string;
  shopName?: string;
  shopId?: string;
  soldCount?: number;
  productUrl?: string;
  productImage?: string;
  anchorType?: string;
}

export class TikTokShopScraper {
  private mainWindow: BrowserWindow | null = null;
  private browserView: BrowserView | null = null;
  private resolvePromise: ((value: ProductInfo) => void) | null = null;
  private rejectPromise: ((reason: Error) => void) | null = null;
  private timeout: NodeJS.Timeout | null = null;
  private capturedProduct: ProductInfo | null = null;
  private partitionCounter: number = 0;

  constructor(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow;
  }

  /**
   * Lấy product info từ video URL
   */
  async getProductInfo(videoUrl: string): Promise<ProductInfo> {
    shopLogger.info(`Getting product info for: ${videoUrl}`);

    return new Promise((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
      this.capturedProduct = null;

      // Timeout sau 20 giây (tăng để đợi page render đầy đủ)
      this.timeout = setTimeout(() => {
        shopLogger.info('Timeout reached - no product found or page load too slow');
        this.cleanup();
        resolve({ hasProduct: false });
      }, 20000);

      // Tạo BrowserView để load page
      this.createBrowserView(videoUrl);
    });
  }

  /**
   * Tạo BrowserView với mobile settings
   */
  private createBrowserView(url: string) {
    // Tạo unique partition cho mỗi request
    this.partitionCounter++;
    const partition = `tiktok-shop-${Date.now()}-${this.partitionCounter}`;
    
    shopLogger.info(`Creating BrowserView with partition: ${partition}`);

    this.browserView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: partition,
        webSecurity: true
      }
    });

    // Block new windows
    this.browserView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // Listen for console messages (captured data from injected script)
    this.browserView.webContents.on('console-message', (_event, _level, message) => {
      if (message.startsWith('TIKTOK_PRODUCT:')) {
        try {
          const jsonStr = message.replace('TIKTOK_PRODUCT:', '');
          const data = JSON.parse(jsonStr);
          shopLogger.info(`Captured product data: ${JSON.stringify(data)}`);
          this.handleCapturedData(data);
        } catch (e) {
          shopLogger.error(`Parse error: ${e}`);
        }
      } else if (message.startsWith('TIKTOK_DEBUG:')) {
        shopLogger.info(`Debug: ${message.replace('TIKTOK_DEBUG:', '')}`);
      }
    });

    // Inject script when DOM is ready
    this.browserView.webContents.on('dom-ready', () => {
      shopLogger.info('DOM ready, injecting capture script');
      this.injectCaptureScript();
    });

    // Also try after full load
    this.browserView.webContents.on('did-finish-load', () => {
      shopLogger.info('Page fully loaded, re-injecting capture script');
      setTimeout(() => this.injectCaptureScript(), 500);
      setTimeout(() => this.injectCaptureScript(), 2000);
    });

    // Handle errors
    this.browserView.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      shopLogger.error(`Page load failed: ${errorCode} - ${errorDescription}`);
    });

    // Load URL với mobile user agent
    shopLogger.info(`Loading URL with Mobile UA: ${url}`);
    this.browserView.webContents.loadURL(url, {
      userAgent: MOBILE_USER_AGENT,
      httpReferrer: 'https://www.tiktok.com/'
    });
  }

  /**
   * Inject script để capture product data từ page
   */
  private injectCaptureScript() {
    const script = `
      (function() {
        if (window.__TIKTOK_PRODUCT_CAPTURED__) return;
        
        console.log('TIKTOK_DEBUG:Script starting...');
        
        // Method 1: Tìm product trong DOM elements (Mobile web không dùng SIGI_STATE)
        function checkDOMElements() {
          console.log('TIKTOK_DEBUG:Checking DOM elements...');
          
          // Các selector cho product anchor trên TikTok mobile
          const productSelectors = [
            // Shop anchor với icon và text
            '[class*="DivProductAnchor"]',
            '[class*="product-anchor"]',
            '[class*="commerce-anchor"]',
            '[class*="ecommerce"]',
            '[class*="EcomAnchor"]',
            '[class*="EcomNameMobile"]',
            '[class*="DivEcomAnchorMobile"]',
            '[data-e2e="product-anchor"]',
            '[data-e2e="video-product"]',
            // Link có chứa shop/product
            'a[href*="/product/"]',
            'a[href*="shop.tiktok"]',
            // Div có text "Shop |"
            'div[class*="Anchor"]',
            'div[class*="anchor"]'
          ];
          
          for (const selector of productSelectors) {
            try {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                const text = el.textContent || '';
                console.log('TIKTOK_DEBUG:Checking element: ' + selector + ' -> "' + text.substring(0, 50) + '"');
                
                // Check nếu có text "Shop" hoặc product-related
                if (text.includes('Shop') || text.includes('shop') || el.href?.includes('product')) {
                  console.log('TIKTOK_DEBUG:Found product element!');
                  
                  // Extract product title - thường format "Shop | Product Name"
                  let productTitle = text.trim();
                  if (productTitle.includes('|')) {
                    productTitle = productTitle.split('|')[1]?.trim() || productTitle;
                  }
                  
                  // Tìm image trong element
                  const img = el.querySelector('img');
                  const productImage = img?.src || '';
                  
                  // Tìm href
                  const productUrl = el.href || el.querySelector('a')?.href || '';
                  
                  window.__TIKTOK_PRODUCT_CAPTURED__ = true;
                  console.log('TIKTOK_PRODUCT:' + JSON.stringify({
                    hasProduct: true,
                    productTitle: productTitle.substring(0, 200),
                    productUrl: productUrl,
                    productImage: productImage,
                    anchorType: 'DOM_SHOP_ANCHOR'
                  }));
                  return true;
                }
              }
            } catch (e) {
              console.log('TIKTOK_DEBUG:Selector error: ' + e.message);
            }
          }
          
          // Fallback: Tìm bất kỳ element nào có text "Shop|" hoặc "Shop |"
          const allElements = document.body.querySelectorAll('div, span, a, p');
          for (const el of allElements) {
            const text = (el.textContent || '').trim();
            // Match "Shop|ProductName" or "Shop | ProductName" - anywhere in text
            const shopMatch = text.match(/Shop\\s*[|｜]\\s*([^\\n|｜]+)/i);
            if (shopMatch && text.length < 300) {
              console.log('TIKTOK_DEBUG:Found Shop pattern: ' + text.substring(0, 100));
              
              const productTitle = shopMatch[1].trim();
              if (productTitle && productTitle.length > 2) {
                // Tìm parent có thể có thêm info
                const parent = el.closest('a') || el.closest('div[class*="anchor"]') || el.parentElement;
                const img = parent?.querySelector('img');
                const productUrl = parent?.href || '';
                
                window.__TIKTOK_PRODUCT_CAPTURED__ = true;
                console.log('TIKTOK_PRODUCT:' + JSON.stringify({
                  hasProduct: true,
                  productTitle: productTitle.substring(0, 200),
                  productUrl: productUrl,
                  productImage: img?.src || '',
                  anchorType: 'DOM_TEXT_SEARCH'
                }));
                return true;
              }
            }
          }
          
          // Fallback 2: Tìm element có "Creator earns commission" badge
          for (const el of allElements) {
            const text = el.textContent || '';
            if (text.includes('earns commission') || text.includes('kiếm hoa hồng') || text.includes('Kiếm hoa hồng')) {
              console.log('TIKTOK_DEBUG:Found commission badge, looking for product nearby');
              // Traverse up to find product info
              let parent = el.parentElement;
              for (let i = 0; i < 5 && parent; i++) {
                const parentText = parent.textContent || '';
                const shopMatch = parentText.match(/Shop\\s*[|｜]\\s*([^\\n]+)/i);
                if (shopMatch) {
                  window.__TIKTOK_PRODUCT_CAPTURED__ = true;
                  console.log('TIKTOK_PRODUCT:' + JSON.stringify({
                    hasProduct: true,
                    productTitle: shopMatch[1].trim().substring(0, 200),
                    anchorType: 'DOM_COMMISSION_SEARCH'
                  }));
                  return true;
                }
                parent = parent.parentElement;
              }
            }
          }
          
          return false;
        }
        
        // Method 2: Check for "Creator earns commission" badge
        function checkCommissionBadge() {
          console.log('TIKTOK_DEBUG:Checking commission badge...');
          
          const badgeSelectors = [
            '[class*="commission"]',
            '[class*="Commission"]',
            '[data-e2e*="commission"]'
          ];
          
          // Also search by text content
          const allText = document.body.innerText || '';
          if (allText.includes('Creator earns commission') || allText.includes('earns commission')) {
            console.log('TIKTOK_DEBUG:Found commission text, searching for product...');
            
            // Nếu có commission badge, tìm product info gần đó
            const elements = document.body.querySelectorAll('*');
            for (const el of elements) {
              const text = el.textContent || '';
              if (text.includes('earns commission') && el.children.length < 3) {
                // Tìm sibling hoặc parent có product info
                const parent = el.parentElement?.parentElement;
                if (parent) {
                  const shopText = parent.querySelector('div')?.textContent || '';
                  if (shopText.includes('Shop')) {
                    let productTitle = shopText;
                    if (productTitle.includes('|')) {
                      productTitle = productTitle.split('|')[1]?.trim() || productTitle;
                    }
                    
                    window.__TIKTOK_PRODUCT_CAPTURED__ = true;
                    console.log('TIKTOK_PRODUCT:' + JSON.stringify({
                      hasProduct: true,
                      productTitle: productTitle.substring(0, 200),
                      anchorType: 'COMMISSION_BADGE'
                    }));
                    return true;
                  }
                }
              }
            }
          }
          
          return false;
        }
        
        // Method 3: SIGI_STATE fallback (for desktop)
        function checkSigiState() {
          const scripts = [
            document.getElementById('SIGI_STATE'),
            document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__')
          ];
          
          for (const script of scripts) {
            if (!script || !script.textContent) continue;
            
            try {
              const data = JSON.parse(script.textContent);
              console.log('TIKTOK_DEBUG:Found SSR data script');
              
              // Tìm anchors trong các paths khác nhau
              const paths = [
                data.ItemModule && Object.values(data.ItemModule)[0],
                data.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct,
                data.itemInfo?.itemStruct
              ];
              
              for (const item of paths) {
                if (item?.anchors?.length > 0) {
                  for (const anchor of item.anchors) {
                    let anchorType = '';
                    try {
                      const logData = JSON.parse(anchor.logExtra || '{}');
                      anchorType = logData.anchor_type || '';
                    } catch (e) {}
                    
                    if (anchorType.includes('SHOP') || anchorType.includes('EC')) {
                      window.__TIKTOK_PRODUCT_CAPTURED__ = true;
                      console.log('TIKTOK_PRODUCT:' + JSON.stringify({
                        hasProduct: true,
                        productTitle: anchor.keyword || anchor.description || '',
                        productUrl: anchor.schema || '',
                        anchorType: anchorType
                      }));
                      return true;
                    }
                  }
                }
              }
            } catch (e) {
              console.log('TIKTOK_DEBUG:SIGI parse error: ' + e.message);
            }
          }
          return false;
        }
        
        // Run all checks
        function runChecks() {
          if (window.__TIKTOK_PRODUCT_CAPTURED__) return;
          
          console.log('TIKTOK_DEBUG:Running product checks...');
          
          // Ưu tiên DOM check vì mobile web không có SIGI_STATE
          if (checkDOMElements()) return;
          if (checkCommissionBadge()) return;
          if (checkSigiState()) return;
          
          console.log('TIKTOK_DEBUG:No product found in this check');
        }
        
        // MutationObserver để watch DOM changes
        function setupObserver() {
          if (window.__TIKTOK_OBSERVER_SET__) return;
          window.__TIKTOK_OBSERVER_SET__ = true;
          
          console.log('TIKTOK_DEBUG:Setting up MutationObserver...');
          
          const observer = new MutationObserver((mutations) => {
            if (window.__TIKTOK_PRODUCT_CAPTURED__) {
              observer.disconnect();
              return;
            }
            
            // Check if any new nodes contain "Shop"
            for (const mutation of mutations) {
              for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) { // Element node
                  const text = node.textContent || '';
                  if (text.includes('Shop') && text.includes('|')) {
                    console.log('TIKTOK_DEBUG:Observer detected Shop element!');
                    runChecks();
                    return;
                  }
                }
              }
            }
          });
          
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
          
          // Auto disconnect after 18 seconds
          setTimeout(() => {
            observer.disconnect();
            console.log('TIKTOK_DEBUG:Observer disconnected');
          }, 18000);
        }
        
        // Run với delays để đợi page render
        runChecks();
        setupObserver();
        setTimeout(runChecks, 1000);
        setTimeout(runChecks, 2000);
        setTimeout(runChecks, 3000);
        setTimeout(runChecks, 5000);
        setTimeout(runChecks, 7000);
        setTimeout(runChecks, 10000);
        
        console.log('TIKTOK_DEBUG:Script injection complete');
      })();
    `;

    this.browserView?.webContents.executeJavaScript(script).catch(e => {
      shopLogger.error(`Script injection error: ${e}`);
    });
  }

  /**
   * Xử lý data đã capture
   */
  private handleCapturedData(data: any) {
    if (data.hasProduct && !this.capturedProduct) {
      this.capturedProduct = data as ProductInfo;
      shopLogger.info(`Product captured: ${data.productTitle}`);
      this.cleanup();
      this.resolvePromise?.(this.capturedProduct);
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.browserView) {
      try {
        // Destroy webContents
        if (!this.browserView.webContents.isDestroyed()) {
          this.browserView.webContents.close();
        }
      } catch (e) {
        shopLogger.warn(`Error cleaning up BrowserView: ${e}`);
      }
      this.browserView = null;
    }
  }

  /**
   * Update main window reference
   */
  setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window;
  }
}

// Singleton instance
let scraperInstance: TikTokShopScraper | null = null;

export function getShopScraper(mainWindow?: BrowserWindow | null): TikTokShopScraper {
  if (!scraperInstance) {
    scraperInstance = new TikTokShopScraper(mainWindow || null);
  } else if (mainWindow) {
    scraperInstance.setMainWindow(mainWindow);
  }
  return scraperInstance;
}

export default TikTokShopScraper;
