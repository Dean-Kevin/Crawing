# Quick Start Guide - IP Fabric Programming Test

## Project Overview
Complete JavaScript/Node.js solution for IP Fabric programming test with:
- **Part 1**: Distributed Web Crawler (Mandatory)
- **Part 2**: Network Device Output Parser (Optional)

## Installation

```bash
cd /home/kevin/Documents/project/Test2
npm install
```

## Running the Project

### Option 1: Quick Unit Tests (Recommended - < 1 second)
```bash
npm test
```
Tests crawler functionality and parser with example data.

### Option 2: Full Live Crawling Demo
```bash
npm start
```
Actually crawls https://ipfabric.io/ (may take 1-2 minutes).

## File Structure

```
src/
├── crawler.js    - Part 1: Web Crawler Implementation
├── parser.js     - Part 2: Network Device Parser  
├── index.js      - Full demonstration with live crawling
└── test.js       - Unit tests and quick validation
```

## Key Files

| File | Purpose |
|------|---------|
| `README.md` | User documentation |
| `SOLUTION.md` | Detailed technical solution |
| `src/crawler.js` | Part 1 implementation (404 lines) |
| `src/parser.js` | Part 2 implementation (224 lines) |
| `src/test.js` | Unit tests (313 lines) |
| `package.json` | Dependencies and scripts |

## Code Examples

### Part 1: Using the Crawler

```javascript
const { DistributedWebCrawler } = require('./src/crawler');

const crawler = new DistributedWebCrawler({
  maxDepth: 3,           // Crawl depth limit
  maxConcurrency: 5,     // Parallel requests
  timeout: 10000,        // Request timeout (ms)
  delayBetweenRequests: 100  // Politeness delay
});

const results = await crawler.crawl('https://example.com');
console.log(`Crawled ${results.length} URLs`);
```

### Part 2: Using the Parser

```javascript
const { NetworkDeviceParser } = require('./src/parser');

const deviceOutput = `
Cisco IOS Software, Version 15.2(4)M1
Model: ISR4321
Serial Number: FGL234567890
...
`;

const parsed = NetworkDeviceParser.parse(deviceOutput);
console.log(parsed.hostname);
console.log(parsed.interfaces);
```

## Design Highlights

### Crawler (Part 1)
- **Pattern**: Worker pool with async/await
- **Deduplication**: Set-based URL tracking
- **Concurrency**: Configurable parallel requests
- **Scalability**: Designed for RabbitMQ/Redis distribution
- **Same-Origin**: Prevents infinite external crawling

### Parser (Part 2)
- **Regex-based**: Flexible pattern matching
- **Auto-detection**: Cisco IOS vs generic device handling
- **Multi-pattern**: Priority-based fallback matching
- **Field extraction**: Hostname, model, serial, interfaces, IPs, MACs
- **Extensible**: Easy to add vendor-specific parsers

## Dependencies

- **axios** - HTTP client for web requests
- **cheerio** - HTML parsing and link extraction

## Performance Notes

**Single Machine**:
- Crawler: ~10-50 URLs/second (network-bound)
- Parser: Instant (< 100ms per device)

**Scaling**:
- Add nodes → Message queues (RabbitMQ/Kafka)
- Deduplication → Distributed store (Redis)
- Coordination → Leader election
- Fault tolerance → Checkpointing system

## Testing Results

All tests pass:
✓ Crawler initialization
✓ URL validation
✓ Same-origin policy
✓ Cisco IOS parsing
✓ Generic device parsing
✓ Field extraction
✓ MAC/IP address parsing

## Documentation

- **README.md** - User guide with features and usage
- **SOLUTION.md** - Detailed technical documentation
- **Code Comments** - Inline documentation throughout

## Contact & Support

For questions about:
- Part 1 (Web Crawler): See `src/crawler.js`
- Part 2 (Network Parser): See `src/parser.js`
- Testing: Run `npm test`
- Architecture: See `SOLUTION.md`

---

**Ready to run!** Start with `npm test` for quick validation.
