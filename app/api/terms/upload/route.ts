import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/terms/upload
 *
 * Proxies encrypted agreement terms to Pinata IPFS.
 * The Pinata JWT is server-side only — never exposed to the client.
 *
 * Accepts: multipart/form-data with:
 *   - file: the encrypted terms blob
 *   - agreementId: for metadata tagging
 *
 * Returns: { cid: string } — the IPFS content hash
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
    const formData = await request.formData();
    const file = formData.get("file");
    const agreementId = formData.get("agreementId");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    // Build Pinata upload request
    const pinataForm = new FormData();
    pinataForm.append("file", file);
    pinataForm.append(
      "pinataMetadata",
      JSON.stringify({
        name: `pnw-terms-${typeof agreementId === "string" ? agreementId.slice(0, 16) : "unknown"}`,
        keyvalues: {
          type: "agreement-terms",
          agreementId: typeof agreementId === "string" ? agreementId.slice(0, 64) : "",
        },
      }),
    );

    const pinataResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: pinataForm,
      },
    );

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error("[PNW] Pinata upload failed:", errorText);
      return NextResponse.json(
        { error: "IPFS upload failed" },
        { status: 502 },
      );
    }

    const pinataData = (await pinataResponse.json()) as {
      IpfsHash: string;
      PinSize: number;
      Timestamp: string;
    };

    return NextResponse.json({ cid: pinataData.IpfsHash });
  } catch (error) {
    console.error("[PNW] Terms upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}
