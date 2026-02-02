const axios = require('axios');
const cheerio = require('cheerio');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

/**
 * PART 1: DISTRIBUTED WEB CRAWLER
 * 
 * ASSUMPTIONS:
 * 1. Single-threaded JS execution model - uses queuing and async/await for concurrency
 * 2. URL deduplication via in-memory Set (for distributed, would use Redis/shared store)
 * 3. Same-origin crawling only to prevent infinite loops
 * 4. Respects basic robots.txt concept (configurable delays between requests)
 * 5. Max depth limit to control crawl scope
 * 6. Request timeout to prevent hanging on slow servers
 * 
 * LIMITATIONS:
 * 1. No JavaScript execution - cannot crawl SPAs or JS-heavy sites
 * 2. No authentication handling
 * 3. No cookie/session management
 * 4. Memory-based deduplication doesn't scale across multiple machines
 * 5. No persistent state between runs
 * 6. Naive URL extraction - doesn't handle all edge cases (data URLs, fragments, etc.)
 * 7. No retry logic for failed requests
 * 8. Linear processing of queue items
 * 
 * SCALABILITY DESIGN:
 * For distributed crawling:
 * - Use message queue (RabbitMQ, Kafka) for URL distribution
 * - Replace Set<string> with Redis/DynamoDB for deduplication
 * - Add worker pool concept with multiple nodes processing queue
 * - Implement priority queue for important URLs
 * - Add checkpointing for fault tolerance
 * - Use consistent hashing for URL partitioning across workers
 */

class DistributedWebCrawler extends EventEmitter {
  constructor(config = {}) {
    super();
    this.visitedUrls = new Set();
    this.discoveredUrls = new Set();
    this.urlQueue = [];
    this.config = {
      maxDepth: config.maxDepth ?? 3,
      maxConcurrency: config.maxConcurrency ?? 5,
      timeout: config.timeout ?? 30000, // Increased from 10000ms to 30000ms
      delayBetweenRequests: config.delayBetweenRequests ?? 100,
      userAgent: config.userAgent ?? 'Mozilla/5.0 (IPFabric-Crawler/1.0)',
      storageDir: config.storageDir ?? './crawl-storage',
      maxRetries: config.maxRetries ?? 3, // Retry failed requests
      retryDelay: config.retryDelay ?? 1000, // Base retry delay (ms)
      connectTimeout: config.connectTimeout ?? 5000, // Connection timeout
      slowHostThreshold: config.slowHostThreshold ?? 15000, // Mark host as slow if response > 15s
    };
    this.results = [];
    this.isRunning = false;
    this.startTime = null;
    this.storageStats = {
      fileCount: 0,
      totalSize: 0,
      totalResults: 0,
      currentFile: null,
      currentSize: 0,
    };
    this.domainsCrawled = new Set();
    this.slowHosts = new Set(); // Track slow hosts for adaptive delays
    this.hostDelays = new Map(); // Per-host delay tracking
  }

  /**
   * Start crawling from seed URL
   */
  async crawl(seedUrl) {
    this.visitedUrls.clear();
    this.discoveredUrls.clear();
    this.urlQueue = [];
    this.results = [];
    this.isRunning = true;
    this.startTime = Date.now();
    this.domainsCrawled.clear();

    // Initialize storage directory
    this.initializeStorage();

    // Validate and normalize seed URL
    try {
      const urlObj = new URL(seedUrl);
      this.urlQueue.push({ url: urlObj.href, depth: 0 });
      this.discoveredUrls.add(urlObj.href);
      const domain = urlObj.hostname;
      this.domainsCrawled.add(domain);
    } catch {
      throw new Error(`Invalid seed URL: ${seedUrl}`);
    }

    // Process queue with concurrency control
    const workers = [];
    for (let i = 0; i < this.config.maxConcurrency; i++) {
      workers.push(this.worker());
    }

    await Promise.all(workers);
    this.isRunning = false;

    // Finalize storage
    this.finalizeStorage();

    return this.results;
  }

  /**
   * Worker processes URLs from queue (simulates a distributed node)
   */
  async worker() {
    while (this.isRunning && this.urlQueue.length > 0) {
      const item = this.urlQueue.shift();
      if (!item) break;

      const { url, depth } = item;

      // Skip if already visited (distributed crawl uses shared store)
      if (this.visitedUrls.has(url)) continue;
      if (depth > this.config.maxDepth) continue;

      this.visitedUrls.add(url);

      try {
        const result = await this.fetchAndParse(url, depth);
        this.results.push(result);

        // Queue discovered URLs
        // In distributed system: publish to message queue instead
        const baseUrl = new URL(url);
        const foundUrls = result.foundUrls || [];
        for (const discoveredUrl of foundUrls) {
          if (
            !this.visitedUrls.has(discoveredUrl) &&
            this.isSameOrigin(discoveredUrl, baseUrl.origin)
          ) {
            this.urlQueue.push({ url: discoveredUrl, depth: depth + 1 });
          }
        }

        // Respect crawl delay
        await this.sleep(this.config.delayBetweenRequests);
      } catch (error) {
        // Log error but continue crawling
        const errorMsg = error.code === 'ECONNABORTED' 
          ? `timeout of ${this.config.timeout}ms exceeded`
          : error.message;
        
        console.log(`[ERROR] Failed to crawl ${url}: ${errorMsg}`);
        this.emit('error', { url, error, message: errorMsg });
        
        // Still respect delay before continuing to next URL
        await this.sleep(this.config.delayBetweenRequests);
      }
    }
  }

  /**
   * Fetch URL content and extract links with retry logic
   */
  async fetchAndParse(url, depth) {
    let lastError = null;
    const retries = this.config.maxRetries;
    const domain = new URL(url).hostname;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Apply adaptive delay for slow hosts
        if (this.slowHosts.has(domain)) {
          const delay = this.hostDelays.get(domain) || this.config.slowHostThreshold;
          console.log(`[SLOW HOST] ${domain} - waiting ${delay}ms before request`);
          await this.sleep(delay);
        }

        const startTime = Date.now();
        
        const response = await axios.get(url, {
          timeout: this.config.timeout,
          headers: { 
            'User-Agent': this.config.userAgent,
            'Accept-Encoding': 'gzip, deflate', // Enable compression
            'Connection': 'keep-alive', // Connection pooling
          },
          validateStatus: () => true, // Accept all status codes
          maxRedirects: 5, // Follow redirects
        });

        const responseTime = Date.now() - startTime;

        // Mark as slow host if response time exceeds threshold
        if (responseTime > this.config.slowHostThreshold) {
          this.slowHosts.add(domain);
          this.hostDelays.set(domain, Math.min(responseTime, 10000)); // Cap at 10s
          console.log(`[MARKED SLOW] ${domain} (${responseTime}ms)`);
        }

        const contentType = response.headers['content-type'] || '';
        const foundUrls = [];
        let title = null;

        // Only parse HTML content
        if (contentType.includes('text/html')) {
          const $ = cheerio.load(response.data);

          // Extract page title
          title = $('title').text() || null;

          // Extract links from various sources
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
              try {
                const absoluteUrl = new URL(href, url).href;
                // Filter out fragments and non-http protocols
                if (absoluteUrl.startsWith('http')) {
                  foundUrls.push(absoluteUrl);
                  this.discoveredUrls.add(absoluteUrl);
                }
              } catch {
                // Skip invalid URLs
              }
            }
          });

          // Also check other link sources
          $('link[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
              try {
                const absoluteUrl = new URL(href, url).href;
                if (absoluteUrl.startsWith('http')) {
                  foundUrls.push(absoluteUrl);
                  this.discoveredUrls.add(absoluteUrl);
                }
              } catch {
                // Skip invalid URLs
              }
            }
          });
        }

        return {
          url,
          depth,
          title,
          status: response.status,
          contentType,
          linksFound: foundUrls.length,
          timestamp: new Date().toISOString(),
          responseTime,
          foundUrls, // Added for internal tracking
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < retries) {
          // Calculate exponential backoff: 1s, 2s, 4s, etc.
          const delayMs = this.config.retryDelay * Math.pow(2, attempt);
          console.log(`[RETRY ${attempt + 1}/${retries}] ${url} - waiting ${delayMs}ms`);
          await this.sleep(delayMs);
        } else {
          // All retries exhausted, throw error
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Check if URL is same origin (prevent crawling entire internet)
   */
  isSameOrigin(urlString, origin) {
    try {
      const url = new URL(urlString);
      return url.origin === origin;
    } catch {
      return false;
    }
  }

  /**
   * Utility: sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get visited URLs (for monitoring/debugging)
   */
  getVisitedUrls() {
    return Array.from(this.visitedUrls);
  }

  /**
   * Get current queue size (for monitoring)
   */
  getQueueSize() {
    return this.urlQueue.length;
  }

  /**
   * Initialize storage directory
   */
  initializeStorage() {
    if (!fs.existsSync(this.config.storageDir)) {
      fs.mkdirSync(this.config.storageDir, { recursive: true });
    }
    this.storageStats = {
      fileCount: 0,
      totalSize: 0,
      totalResults: 0,
      currentFile: null,
      currentSize: 0,
    };
  }

  /**
   * Store result to JSONL file
   */
  storeResult(result) {
    const timestamp = new Date(this.startTime).toISOString().split('T')[0];
    const timeStr = new Date(this.startTime).toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `results-${timeStr}-0.jsonl`;
    const filePath = path.join(this.config.storageDir, fileName);

    // Append to JSONL file
    fs.appendFileSync(filePath, JSON.stringify(result) + '\n');

    this.storageStats.currentFile = fileName;
    this.storageStats.totalResults++;
    
    // Update file size
    const stats = fs.statSync(filePath);
    this.storageStats.currentSize = stats.size;
    this.storageStats.totalSize = stats.size;
  }

  /**
   * Finalize storage and export results
   */
  finalizeStorage() {
    // Update file count
    const files = fs.readdirSync(this.config.storageDir).filter(f => f.endsWith('.jsonl'));
    this.storageStats.fileCount = files.length;

    // Export to JSON
    this.exportToJSON();
  }

  /**
   * Export results to JSON file
   */
  exportToJSON(filename = 'crawl-results.json') {
    const jsonData = {
      metadata: {
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: this.getDuration(),
        totalCrawled: this.results.length,
        totalDiscovered: this.discoveredUrls.size,
      },
      results: this.results,
    };

    const filePath = path.join(process.cwd(), filename);
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));

    return filePath;
  }

  /**
   * Get crawl duration in seconds
   */
  getDuration() {
    if (!this.startTime) return 0;
    return ((Date.now() - this.startTime) / 1000).toFixed(2) + 's';
  }

  /**
   * Get pages per second rate
   */
  getPagesPerSecond() {
    if (!this.startTime) return 0;
    const seconds = (Date.now() - this.startTime) / 1000;
    return (this.results.length / seconds).toFixed(2);
  }

  /**
   * Search results for keyword
   */
  search(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return this.results.filter(
      (result) =>
        (result.title && result.title.toLowerCase().includes(lowerKeyword)) ||
        result.url.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Get statistics about crawl
   */
  getStats() {
    const duration = (Date.now() - (this.startTime || Date.now())) / 1000;
    return {
      totalCrawled: this.results.length,
      totalDiscovered: this.discoveredUrls.size,
      startTime: this.startTime,
      duration: duration.toFixed(2) + 's',
      pagesPerSecond: (this.results.length / duration).toFixed(2),
      domainsCrawled: this.domainsCrawled.size,
    };
  }
}

module.exports = { DistributedWebCrawler };
