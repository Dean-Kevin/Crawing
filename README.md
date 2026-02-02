# IP Fabric Programming Test

A JavaScript/Node.js solution for the IP Fabric programming test with two components:

## Part 1: Distributed Web Crawler

A scalable web crawler that:
- Downloads URLs and extracts discovered URLs from HTML content
- Implements concurrent fetching with configurable concurrency levels
- Tracks visited URLs to prevent duplicate processing
- Respects same-origin policy to prevent crawling the entire internet
- Includes configurable depth limits, timeouts, and request delays

### Key Features:
- **Distributed Architecture**: Uses worker pool pattern simulating multiple nodes
- **Event-driven**: Emits error events for monitoring
- **Concurrent Processing**: Configurable concurrency with async/await
- **Content-aware**: Only processes HTML content for link extraction
- **Metrics**: Tracks URLs visited and queue depth

### Assumptions & Limitations:
1. **No JavaScript Execution**: Cannot crawl SPAs or JS-heavy sites
2. **In-Memory Deduplication**: Set-based tracking (use Redis for distributed)
3. **Same-Origin Only**: Prevents crawling outside target domain
4. **No Authentication**: Basic HTTP requests only
5. **No Retry Logic**: Failed requests are skipped

### Scalability Design:
For large-scale distributed crawling:
- **Message Queues**: Use RabbitMQ/Kafka for URL distribution
- **Distributed Deduplication**: Redis/DynamoDB for visited URLs tracking
- **Worker Pool**: Multiple machines processing shared queue
- **Fault Tolerance**: Checkpointing and persistent state
- **Load Balancing**: Consistent hashing for URL partitioning

## Part 2: Network Device Output Parser

Parses unstructured network device outputs (Cisco IOS, generic formats) into structured JSON using regex patterns.

### Supported Device Types:
- Cisco IOS routers and switches
- Generic network devices (FortiGate, Juniper, etc.)

### Extracted Information:
- Hostname, model, serial number
- Software version, uptime
- Interface details (name, status, protocol, MTU, speed, IP, MAC)

### Regex Strategy:
- **Device Detection**: Identifies vendor/OS type
- **Multi-Pattern Matching**: Priority-based fallback patterns
- **Context-Aware Extraction**: Looks ahead/behind for related fields
- **Status Normalization**: Standardizes various status values

## Installation & Usage

```bash
# Install dependencies
npm install

# Run the program
npm start
```

## Project Structure

```
src/
  ├── crawler.js    # Part 1: Web crawler implementation
  ├── parser.js     # Part 2: Network device parser
  └── index.js      # Main demonstration and testing
```

## Configuration

### Crawler Options
```javascript
{
  maxDepth: 3,                    // Maximum crawl depth
  maxConcurrency: 5,              // Concurrent requests
  timeout: 10000,                 // Request timeout (ms)
  delayBetweenRequests: 100,      // Delay between requests (ms)
  userAgent: 'Mozilla/5.0...'     // Custom user agent
}
```

## Future Improvements

### Crawler:
- Distributed state management with Redis
- Message queue integration (RabbitMQ/Kafka)
- JavaScript execution via Puppeteer
- Authentication and cookie handling
- Retry logic with exponential backoff
- robots.txt compliance

### Parser:
- Vendor-specific parsers (Juniper, Arista, etc.)
- ML-based format detection
- Output schema validation
- Streaming parser for large outputs
- Plugin architecture for custom parsers

## Dependencies

- **axios**: HTTP client
- **cheerio**: HTML parsing and manipulation

## License

MIT
