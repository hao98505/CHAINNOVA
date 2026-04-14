/**
 * GET /api/price-signature?user=0x...
 *
 * Returns a watcher-signed price attestation for use with
 * BottomProtectionVault.redeem().
 *
 * Response (200):
 * {
 *   refPrice:  "123456789012345",   // BNB/CNOVA, 1e18 precision (string)
 *   deadline:  1714000000,          // unix timestamp
 *   nonce:     "3",                 // user's current on-chain nonce (string)
 *   v: 28,
 *   r: "0x...",
 *   s: "0x..."
 * }
 *
 * Error (400): { error: "missing user parameter" }
 * Error (503): { error: "signer not configured" | "price unavailable" }
 */

import { Router, Request, Response } from "express";
import { buildPriceSignature, getRefPriceBnbWei } from "../price-signer";

const router = Router();

router.get("/api/price-signature", async (req: Request, res: Response) => {
  const user = req.query.user as string | undefined;

  if (!user || !/^0x[0-9a-fA-F]{40}$/.test(user)) {
    res.status(400).json({ error: "missing or invalid user parameter (must be EVM address)" });
    return;
  }

  if (!process.env.SIGNER_PRIVATE_KEY) {
    res.status(503).json({ error: "signer not configured — SIGNER_PRIVATE_KEY missing" });
    return;
  }

  if (!process.env.BOTTOM_PROTECTION_ADDRESS) {
    res.status(503).json({ error: "BOTTOM_PROTECTION_ADDRESS not configured" });
    return;
  }

  try {
    const sig = await buildPriceSignature(user);

    if (sig.refPrice === "0") {
      res.status(503).json({ error: "price unavailable — all price sources failed" });
      return;
    }

    res.json(sig);
  } catch (err: any) {
    console.error("[priceSignature] Error:", err?.message ?? err);
    res.status(500).json({ error: "internal error" });
  }
});

/**
 * GET /api/current-price
 * Returns the current cached CNOVA price in BNB (for UI display, no signature).
 */
router.get("/api/current-price", async (_req: Request, res: Response) => {
  try {
    const price = await getRefPriceBnbWei();
    res.json({ priceBnbWei: price.toString() });
  } catch (err: any) {
    res.status(500).json({ error: "failed to fetch price" });
  }
});

export default router;
