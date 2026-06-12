import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/timekeeping/upload
 *
 * Proxies an encrypted punch envelope to Pinata IPFS with metadata tags
 * for worker address and week ID. The Pinata JWT is server-side only.
 *
 * Accepts JSON: { envelope, workerAddress, weekId, punchType, date }
 * Returns: { cid: string }
 */
export async function POST(request: NextRequest) {
  const jwt = process.env.PINATA_JWT;

  if (!jwt) {
    return NextResponse.json(
      { error: "Pinata not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { envelope, workerAddress, weekId, punchType, date } = body;

    if (!envelope || !workerAddress || !weekId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Pin the encrypted envelope as a JSON file
    const envelopeBlob = new Blob([JSON.stringify(envelope)], {
      type: "application/json",
    });

    const pinataForm = new FormData();
    pinataForm.append(
      "file",
      envelopeBlob,
      `punch-${workerAddress.slice(0, 12)}-${Date.now()}.enc.json`,
    );
    pinataForm.append(
      "pinataMetadata",
      JSON.stringify({
        name: `pnw-punch-${weekId}-${punchType === 1 ? "in" : "out"}`,
        keyvalues: {
          pnw_type: "punch",
          worker: workerAddress,
          week: weekId,
          punch_type: String(punchType),
          date: date ?? "",
        },
      }),
    );

    const pinataResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: pinataForm,
      },
    );

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error("[PNW-TK] Pinata upload failed:", errorText);
      return NextResponse.json(
        { error: "IPFS upload failed" },
        { status: 502 },
      );
    }

    const pinataData = (await pinataResponse.json()) as {
      IpfsHash: string;
      PinSize: number;
    };

    return NextResponse.json({ cid: pinataData.IpfsHash });
  } catch (error) {
    console.error("[PNW-TK] Punch upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
