import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/terms/lookup?agreementId=...
 *
 * Looks up the IPFS CID for encrypted agreement terms.
 * Uses a simple in-memory map populated by the upload endpoint.
 *
 * For production, this should use a proper database or on-chain mapping.
 * For testnet/demo, we use Vercel's edge runtime KV or a file-based approach.
 */

// Simple CID store — in production this would be a database
// For now, we query Pinata's pin list by metadata name
export async function GET(request: NextRequest) {
  const jwt = process.env.PINATA_JWT;

  if (!jwt) {
    return NextResponse.json(
      { error: "Pinata not configured" },
      { status: 500 },
    );
  }

  const agreementId = request.nextUrl.searchParams.get("agreementId");

  if (!agreementId) {
    return NextResponse.json(
      { error: "agreementId parameter required" },
      { status: 400 },
    );
  }

  try {
    // Query Pinata for pins with matching name metadata
    const searchName = `pnw-terms-${agreementId.slice(0, 16)}`;
    const url = `https://api.pinata.cloud/data/pinList?metadata[name]=${encodeURIComponent(searchName)}&status=pinned&pageLimit=1`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[PNW] Pinata lookup failed:", response.status, errorText);
      return NextResponse.json(
        { error: "Lookup failed" },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      rows: Array<{ ipfs_pin_hash: string }>;
    };

    if (data.rows.length > 0 && data.rows[0]) {
      return NextResponse.json({ cid: data.rows[0].ipfs_pin_hash });
    }

    return NextResponse.json({ error: "Terms not found" }, { status: 404 });
  } catch (error) {
    console.error("[PNW] Terms lookup error:", error);
    return NextResponse.json(
      { error: "Lookup failed" },
      { status: 500 },
    );
  }
}
