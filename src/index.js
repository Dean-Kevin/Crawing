const { DistributedWebCrawler } = require('./crawler');
const { NetworkDeviceParser } = require('./parser');

/**
 * Main demonstration and testing file for IP Fabric Programming Test
 */

async function demonstrateCrawler() {
  console.log('='.repeat(70));
  console.log('PART 1: DISTRIBUTED WEB CRAWLER DEMONSTRATION');
  console.log('='.repeat(70));
  console.log();

  const crawler = new DistributedWebCrawler({
    maxDepth: 1,
    maxConcurrency: 3,
    timeout: 30000, // Increased timeout for slow servers
    delayBetweenRequests: 500,
    maxRetries: 3, // Retry failed requests
    retryDelay: 1000, // Base retry delay
    slowHostThreshold: 15000, // Mark host as slow if response > 15s
  });

  crawler.on('error', (event) => {
    console.log(`[ERROR] Failed to crawl ${event.url}: ${event.error.message}`);
  });

  try {
    console.log('Starting crawl of https://example.com/');
    console.log('Configuration: maxDepth=1, maxConcurrency=3');
    console.log();

    const results = await crawler.crawl('https://example.com/');

    // Display sample results
    console.log('Sample results (first 3 pages):');
    results.slice(0, 3).forEach((result, i) => {
      console.log(`${i + 1}. ${result.url}`);
      if (result.title) {
        console.log(`   Title: ${result.title}`);
      }
      console.log(`   Status: ${result.status}`);
      console.log(`   Links found: ${result.linksFound}`);
      console.log(`   Depth: ${result.depth}`);
      console.log(`   Timestamp: ${result.timestamp}`);
      console.log();
    });

    // Display storage stats
    console.log(`Stored ${results.length} results to disk`);
    console.log('Storage stats:', JSON.stringify(crawler.storageStats, null, 2));
    console.log();

    // Export and display export info
    const exportPath = crawler.exportToJSON();
    console.log(`Exported ${results.length} results to ${exportPath}`);
    console.log();

    // Search demonstration
    const searchResults = crawler.search('ip fabric');
    console.log(`Search results for 'ip fabric': ${searchResults.length} pages found`);
    console.log();

    // Display URL store stats
    const stats = crawler.getStats();
    console.log('URL Store stats:', JSON.stringify(stats, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('CRAWLER DESIGN NOTES:');
    console.log('='.repeat(70));
    console.log(`
SCALABILITY FOR DISTRIBUTED SYSTEMS:
1. Message Queue Layer:
   - Replace urlQueue with RabbitMQ/Kafka topic for URL distribution
   - Each worker subscribes to "pending-urls" topic
   - Crawled URLs published to "completed-urls" topic

2. Deduplication (Distributed):
   - Replace Set<string> with Redis/DynamoDB for centralized tracking
   - Use SETEX with TTL for visited URLs (prevents infinite loops)
   - Atomic check-and-set operations for thread safety

3. Worker Coordination:
   - Each machine runs N crawler instances
   - Leader election for checkpointing crawl progress
   - Distributed cache for metadata (robots.txt, host delays)

4. Fault Tolerance:
   - Persistent queue ensures no URLs lost if worker crashes
   - Checkpointing with heartbeat mechanism
   - Dead-letter queue for problematic URLs

5. Load Balancing:
   - Consistent hashing: URL -> Worker assignment
   - Dynamic worker pool scaling based on queue depth
   - Priority queue for important URLs (higher-level URLs processed first)

6. Performance Optimization:
   - DNS resolution caching across workers
   - HTTP connection pooling per host
   - Batch processing: fetch multiple URLs in single HTTP request where possible
    `);
  } catch (error) {
    console.error('Crawler error:', error);
  }
}

function demonstrateParser() {
  console.log('\n' + '='.repeat(60));
  console.log('PART 2: NETWORK DEVICE OUTPUT PARSER DEMONSTRATION');
  console.log('='.repeat(60));
  console.log();

  // Example Cisco IOS output
  const ciscoIOSExample = `
Cisco IOS Software, Router Software, Version 15.2(4)M1

router#show version
Cisco IOS Software [Amsterdam], ISR4000 Software, Version 15.2(4)M1
Technical Support: http://www.cisco.com/techsupport
Copyright (c) 1986-2014 by Cisco Systems, Inc.
Compiled Wed 15-Jan-14 11:13 by prod_rel_team
Model Number                    : ISR4321
System Serial Number            : FGL234567890
Configuration register is 0x2102

router#show interfaces
Ethernet0/0 is up, line protocol is up
  Hardware is iEthernet, address is aabb.cc00.0010
  Internet address is 192.168.1.1/24
  MTU 1500 bytes, BW 1000000 Kbit
  Encapsulation ARPA, loopback not set
Ethernet0/1 is down, line protocol is down
  Hardware is iEthernet, address is aabb.cc00.0011
  MTU 1500 bytes, BW 1000000 Kbit
GigabitEthernet0/0/0 is up, line protocol is up
  Hardware is gigabit ethernet, address is aabb.cc00.0020
  Internet address is 10.0.0.1/24
  MTU 1500 bytes, BW 1000000000 Kbit
Serial0/0/0 is down, line protocol is down
  Hardware is Serial, address is aabb.cc00.0030
  MTU 1500 bytes, BW 64000 Kbit
Loopback0 is up, line protocol is up
  Hardware is Loopback
  Internet address is 172.16.0.1/32
  MTU 65535 bytes, BW 8000000 Kbit
`;

  console.log('Testing Cisco IOS Parser:');
  console.log('Input (sample):');
  console.log(ciscoIOSExample.substring(0, 300) + '...');
  console.log();

  const parsedCisco = NetworkDeviceParser.parse(ciscoIOSExample);

  console.log('Output (Parsed):');
  console.log(JSON.stringify(parsedCisco, null, 2));

  // Example generic device output
  const genericExample = `
hostname: core-router-01
device type: FortiGate 3000D
model: FortiGate3000D
serial number: FG34D5E16789012
software version: 6.2.5
uptime: 245 days, 3 hours, 12 minutes

Interface Configuration:
eth0 up
  ip address: 203.0.113.1/24
  hwaddr: 00:11:22:33:44:55
eth1 down
  ip address: 203.0.113.2/24
  hwaddr: 00:11:22:33:44:56
eth2 up
  ip address: 198.51.100.1/24
  hwaddr: 00:11:22:33:44:57
eth3 active
  hwaddr: 00:11:22:33:44:58
`;

  console.log('\n' + '-'.repeat(60));
  console.log('Testing Generic Device Parser:');
  console.log('Input (sample):');
  console.log(genericExample.substring(0, 300) + '...');
  console.log();

  const parsedGeneric = NetworkDeviceParser.parse(genericExample);

  console.log('Output (Parsed):');
  console.log(JSON.stringify(parsedGeneric, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('PARSER DESIGN NOTES:');
  console.log('='.repeat(60));
  console.log(`
REGEX PARSING STRATEGY:
1. Device Type Detection:
   - Identify vendor/OS through pattern matching
   - Route to appropriate specialized parser for optimal accuracy

2. Hostname Extraction:
   - Multiple patterns for different device types
   - Priority: prompt-based > config-based > fallback

3. Interface Parsing:
   - Flexible naming patterns (eth, Ethernet, GigabitEthernet, etc.)
   - Context-aware extraction: look ahead/behind for MTU, speed, IP
   - Status normalization to standard values

4. Future Improvements:
   - XPath/CSS selectors for structured device outputs
   - ML-based format detection for custom devices
   - Pluggable vendor-specific parsers
   - State machine parser for complex multi-line values
   - Streaming parser for large outputs

5. Extensibility:
   - Add vendor-specific parsers: parseJuniper(), parseArista(), etc.
   - Custom pattern registry for new device types
   - Output schema validation
   - Transformation plugins post-parsing
    `);
}

async function main() {
  try {
    await demonstrateCrawler();
    demonstrateParser();

    console.log('\n' + '='.repeat(60));
    console.log('PROGRAM COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
