/**
 * PART 2: NETWORK DEVICE OUTPUT PARSER
 * 
 * Parses unstructured network device output into structured JSON
 * This example handles common network device outputs like Cisco IOS, Juniper, etc.
 */

class NetworkDeviceParser {
  /**
   * Parse Cisco-style device output into structured JSON
   */
  static parseCiscoIOS(text) {
    const result = {};
    const interfaces = [];

    // Extract hostname from "Router#" or similar prompts
    const hostnameMatch = text.match(/^(\S+)[\#>%]/m);
    if (hostnameMatch) {
      result.hostname = hostnameMatch[1];
    }

    // Extract from "show version" style output
    const modelMatch = text.match(/(?:Model|Processor board ID|Cisco\s+).*?(\S+)(?:\s|$)/i);
    if (modelMatch) {
      result.model = modelMatch[1];
    }

    const serialMatch = text.match(/Serial\s*(?:Number)?[:\s]+([A-Z0-9]+)/i);
    if (serialMatch) {
      result.serialNumber = serialMatch[1];
    }

    const versionMatch = text.match(
      /(?:Cisco\s+IOS|System)\s+(?:Software|Version|Release).*?([0-9]+\.[0-9]+\.[0-9]+)/i
    );
    if (versionMatch) {
      result.softwareVersion = versionMatch[1];
    }

    // Extract uptime from "show version" output
    const uptimeMatch = text.match(
      /uptime[:\s]+(\d+\s+(?:years?|weeks?|days?|hours?|minutes?)(?:\s*,\s*\d+\s+(?:years?|weeks?|days?|hours?|minutes?))*)/i
    );
    if (uptimeMatch) {
      result.uptime = uptimeMatch[1];
    }

    // Parse interfaces from "show interfaces" output
    // Pattern: Interface name (e.g., "Ethernet0/0", "GigabitEthernet0/0/0")
    const interfacePattern =
      /^\s*((?:Ethernet|GigabitEthernet|FastEthernet|Serial|Loopback|Vlan|Port-channel)\d+(?:\/\d+)*)\s+(?:is\s+)?(\w+)(?:\s+.*protocol\s+is\s+(\w+))?/gm;

    let match;
    while ((match = interfacePattern.exec(text)) !== null) {
      const iface = {
        name: match[1],
        status: match[2].toLowerCase(),
        protocol: match[3]?.toLowerCase() || 'unknown',
      };

      // Try to extract more details for this interface
      // Look for MTU, MAC address in subsequent lines
      const ifaceSection = text.substring(match.index, match.index + 500);

      const mtuMatch = ifaceSection.match(/MTU\s+(\d+)/i);
      if (mtuMatch) {
        iface.mtu = parseInt(mtuMatch[1], 10);
      }

      const macMatch = ifaceSection.match(
        /(?:Hardware.*?address|MAC address)[:\s]+([A-Fa-f0-9]{2}(?:[:\-][A-Fa-f0-9]{2}){5})/i
      );
      if (macMatch) {
        iface.macAddress = macMatch[1];
      }

      const speedMatch = ifaceSection.match(
        /(?:BW|Speed|Bandwidth)[:\s]+(\d+\s+(?:Kbit|Mbit|Gbit|bps))/i
      );
      if (speedMatch) {
        iface.speed = speedMatch[1];
      }

      const ipMatch = ifaceSection.match(
        /Internet\s+address[:\s]+(\d+\.\d+\.\d+\.\d+)/i
      );
      if (ipMatch) {
        iface.ipAddress = ipMatch[1];
      }

      interfaces.push(iface);
    }

    if (interfaces.length > 0) {
      result.interfaces = interfaces;
    }

    return result;
  }

  /**
   * Parse generic network device output
   * Handles various formats and device types
   */
  static parseGeneric(text) {
    const result = {};
    const interfaces = [];

    // Try multiple patterns for hostname
    const hostnamePatterns = [
      /^([\w\-\.]+)[\#>\%]/m, // Prompt-based
      /hostname[:\s]+([^\n]+)/i,
      /device\s+name[:\s]+([^\n]+)/i,
    ];

    for (const pattern of hostnamePatterns) {
      const match = text.match(pattern);
      if (match) {
        result.hostname = match[1].trim();
        break;
      }
    }

    // Try multiple patterns for model/device type
    const modelPatterns = [
      /model[:\s]+([^\n]+)/i,
      /device\s+(?:type|model)[:\s]+([^\n]+)/i,
      /(?:Cisco|Juniper|Arista|HP|Dell)\s+(\S+)/i,
    ];

    for (const pattern of modelPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.model = match[1].trim();
        break;
      }
    }

    // Version patterns
    const versionPatterns = [
      /version[:\s]+([0-9\.]+[^\n]*)/i,
      /software\s+version[:\s]+([0-9\.]+[^\n]*)/i,
      /os\s+version[:\s]+([0-9\.]+[^\n]*)/i,
    ];

    for (const pattern of versionPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.softwareVersion = match[1].trim();
        break;
      }
    }

    // Serial number
    const serialPatterns = [
      /serial\s*(?:number)?[:\s]+([A-Z0-9\-]+)/i,
      /sn[:\s]+([A-Z0-9\-]+)/i,
    ];

    for (const pattern of serialPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.serialNumber = match[1].trim();
        break;
      }
    }

    // Interface parsing - more flexible pattern
    const ifaceLines = text.split('\n');
    for (let i = 0; i < ifaceLines.length; i++) {
      const line = ifaceLines[i];

      // Match various interface naming schemes
      const ifaceMatch = line.match(
        /^\s*((?:[A-Za-z\-]+\d+(?:\/\d+)*)|(?:eth\d+)|(?:em\d+)|(?:eno\d+))\s+/
      );

      if (ifaceMatch) {
        const iface = {
          name: ifaceMatch[1].trim(),
          status: 'unknown',
          protocol: 'unknown',
        };

        // Extract status from same line or nearby lines
        if (line.match(/\b(?:up|down|administratively down|active|inactive)\b/i)) {
          const statusMatch = line.match(
            /\b(up|down|administratively down|active|inactive)\b/i
          );
          if (statusMatch) {
            iface.status = statusMatch[1].toLowerCase();
          }
        }

        // Look ahead for more details
        const nextLines = ifaceLines.slice(i, Math.min(i + 5, ifaceLines.length)).join('\n');

        const ipMatch = nextLines.match(/(?:inet|ip address)[:\s]+(\d+\.\d+\.\d+\.\d+)/i);
        if (ipMatch) {
          iface.ipAddress = ipMatch[1];
        }

        const macMatch = nextLines.match(
          /(?:hwaddr|ether|mac address)[:\s]+([A-Fa-f0-9]{2}(?:[:\-][A-Fa-f0-9]{2}){5})/i
        );
        if (macMatch) {
          iface.macAddress = macMatch[1];
        }

        interfaces.push(iface);
      }
    }

    if (interfaces.length > 0) {
      result.interfaces = interfaces;
    }

    return result;
  }

  /**
   * Auto-detect device type and parse accordingly
   */
  static parse(text) {
    // Detect device type
    if (text.match(/Cisco\s+IOS|Router.*#|Switch.*#/i)) {
      return this.parseCiscoIOS(text);
    }

    // Default to generic parser
    return this.parseGeneric(text);
  }
}

module.exports = { NetworkDeviceParser };
