/**
 * NAT Commands Utility
 *
 * Generates iptables commands for Proxmox NAT deployment
 */

interface NATRule {
  nat_mode: string;
  protocol: string;
  external_ip: string;
  external_port: number | null;
  internal_ip: string;
  internal_port: number | null;
  interface: string;
}

/**
 * Build iptables command for creating NAT rule
 */
export function buildProxmoxNATCommand(rule: NATRule): string {
  const { nat_mode, protocol, external_ip, external_port, internal_ip, internal_port, interface: iface } = rule;

  switch (nat_mode) {
    case 'dnat':
      // DNAT (Destination NAT) - Port forwarding
      if (!external_port || !internal_port) {
        throw new Error('DNAT requires both external_port and internal_port');
      }
      return `
iptables -t nat -A PREROUTING -i ${iface} -p ${protocol} -d ${external_ip} --dport ${external_port} -j DNAT --to-destination ${internal_ip}:${internal_port}
iptables -A FORWARD -p ${protocol} -d ${internal_ip} --dport ${internal_port} -j ACCEPT
      `.trim();

    case 'snat':
      // SNAT (Source NAT) - Outbound NAT
      return `
iptables -t nat -A POSTROUTING -o ${iface} -s ${internal_ip} -j SNAT --to-source ${external_ip}
      `.trim();

    case 'masquerade':
      // Masquerade - Dynamic SNAT
      return `
iptables -t nat -A POSTROUTING -o ${iface} -s ${internal_ip} -j MASQUERADE
      `.trim();

    case 'one_to_one':
      // 1:1 NAT - Bidirectional mapping
      return `
iptables -t nat -A PREROUTING -i ${iface} -d ${external_ip} -j DNAT --to-destination ${internal_ip}
iptables -t nat -A POSTROUTING -o ${iface} -s ${internal_ip} -j SNAT --to-source ${external_ip}
      `.trim();

    default:
      throw new Error(`Unsupported NAT mode: ${nat_mode}`);
  }
}

/**
 * Build iptables command for deleting NAT rule
 * Ignores errors if rule doesn't exist (using || true)
 */
export function buildProxmoxNATDeleteCommand(rule: NATRule): string {
  // Build delete commands (replace -A with -D and add error handling)
  const createCmd = buildProxmoxNATCommand(rule);
  const deleteCmd = createCmd.replace(/-A /g, '-D ');

  // Add "|| true" to each line to ignore errors if rule doesn't exist
  const lines = deleteCmd.split('\n');
  const safelines = lines.map(line => line.trim() ? `${line} 2>/dev/null || true` : line);

  return safelines.join('\n');
}

/**
 * Build command to check if NAT rule exists
 */
export function buildProxmoxNATCheckCommand(rule: NATRule): string {
  // Check if rule exists (replace -A with -C)
  const createCmd = buildProxmoxNATCommand(rule);
  const lines = createCmd.split('\n');
  return lines[0].replace(/-A /, '-C ');
}

/**
 * Build command to persist iptables rules
 * Creates directory if it doesn't exist and saves rules
 */
export function buildProxmoxNATPersistCommand(): string {
  return `
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
ip6tables-save > /etc/iptables/rules.v6 2>/dev/null || true
  `.trim();
}

/**
 * Build command to list current NAT rules
 */
export function buildProxmoxNATListCommand(): string {
  return 'iptables -t nat -L -n -v';
}
