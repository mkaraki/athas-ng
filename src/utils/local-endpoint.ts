const LOCAL_HOST_SUFFIXES = [".localhost", ".local", ".lan", ".home.arpa", ".internal"];

function isPrivateIPv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return false;
  const [a, b] = parts;
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    // Carrier-grade NAT space, which Tailscale and similar private networks use.
    (a === 100 && b >= 64 && b <= 127) ||
    hostname === "0.0.0.0"
  );
}

function isPrivateIPv6(hostname: string) {
  const address = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    address === "::1" ||
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    /^fe[89ab]/.test(address)
  );
}

/** Whether `url` points at this machine or the local network, so requests to it stay private. */
export function isLocalEndpointUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!hostname) return false;
  if (hostname === "localhost") return true;
  if (LOCAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return true;
  return isPrivateIPv4(hostname) || (hostname.includes(":") && isPrivateIPv6(hostname));
}
