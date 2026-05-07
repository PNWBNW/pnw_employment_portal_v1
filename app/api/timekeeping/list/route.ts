import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/timekeeping/list?worker=<address>&week=<weekId>
 *
 * Queries Pinata for all encrypted punch pins matching a worker + week.
 * Uses the Pinata pinList API with metadata key-value filtering.
 *
 * Returns: { pins: [{ cid, metadata }] }
 */
export async function GET(request: NextRequest) {
  const jwt = process.env.PINATA_JWT;

  if (!jwt) {
    return NextResponse.json(
      { error: "Pinata not configured" },
      { status: 500 },
    );
  }

  const worker = request.nextUrl.searchParams.get("worker");
  const week = request.nextUrl.searchParams.get("week");

  if (!worker || !week) {
    return NextResponse.json(
      { error: "Missing worker or week parameter" },
      { status: 400 },
    );
  }

  try {
    // Pinata pinList API with metadata filtering
    const params = new URLSearchParams({
      status: "pinned",
      "metadata[keyvalues][pnw_type]": JSON.stringify({
        value: "punch",
        op: "eq",
      }),
      "metadata[keyvalues][worker]": JSON.stringify({
        value: worker,
        op: "eq",
      }),
      "metadata[keyvalues][week]": JSON.stringify({
        value: week,
        op: "eq",
      }),
      pageLimit: "100",
    });

    const pinataResponse = await fetch(
      `https://api.pinata.cloud/data/pinList?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${jwt}` },
      },
    );

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error("[PNW-TK] Pinata list failed:", errorText);
      return NextResponse.json(
        { error: "IPFS list failed" },
        { status: 502 },
      );
    }

    const pinataData = (await pinataResponse.json()) as {
      count: number;
      rows: {
        ipfs_pin_hash: string;
        metadata: { name: string; keyvalues: Record<string, string> };
      }[];
    };

    const pins = pinataData.rows.map((row) => ({
      cid: row.ipfs_pin_hash,
      metadata: row.metadata?.keyvalues ?? {},
    }));

    return NextResponse.json({ pins });
  } catch (error) {
    console.error("[PNW-TK] Punch list error:", error);
    return NextResponse.json({ error: "List failed" }, { status: 500 });
  }
}
