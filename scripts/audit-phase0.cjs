const fs = require("fs");
const path = require("path");

const BANNED = [
  "Bridge v3",
  "Bidirectional Solana",
  "deposit to vault",
  "custodial MVP",
  "Custodial MVP",
  "replaced by Bridge v3",
  "VITE_SOLANA_VAULT",
  "SOLANA_VAULT_KEYPAIR",
  "SOLANA_VAULT_ATA",
  "SOLANA_VAULT=",
  "Vault deposits are disabled",
];

const FILES = [
  "replit.md",
  "client/src/lib/solanaBridge.ts",
  "client/src/lib/evmBridge.ts",
  "client/src/lib/bridgeRouter.ts",
  "client/src/pages/Bridge.tsx",
];

let failures = 0;

for (const rel of FILES) {
  const full = path.join(__dirname, "..", rel);
  if (!fs.existsSync(full)) {
    console.log(`SKIP  ${rel} (not found)`);
    continue;
  }
  const content = fs.readFileSync(full, "utf8");
  for (const term of BANNED) {
    if (content.includes(term)) {
      console.log(`FAIL  ${rel} contains banned term: "${term}"`);
      failures++;
    }
  }
  if (!failures) {
    console.log(`PASS  ${rel}`);
  }
}

if (failures > 0) {
  console.log(`\n✗ ${failures} violation(s) found`);
  process.exit(1);
} else {
  console.log(`\n✓ All files clean — Phase 0 audit passed`);
  process.exit(0);
}
