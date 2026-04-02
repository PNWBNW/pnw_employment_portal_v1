"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useTransactionExecutor } from "@/src/lib/wallet/useTransactionExecutor";
import { PROGRAMS } from "@/src/config/programs";
import { INDUSTRY_SUFFIXES, queryNamePlaintext } from "@/src/registry/name_registry";
import { PAY_FREQUENCY_LABELS } from "@/src/handshake/types";
import { domainHash, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode } from "@/src/lib/pnw-adapter/canonical_encoder";
import { decryptTerms } from "@/src/lib/terms-vault/encrypt";
import { lookupTermsCid, fetchEncryptedTerms } from "@/src/lib/terms-vault/ipfs";

type PendingOffer = {
  agreement_id: string;
  employer_name_hash: string;
  worker_name_hash: string;
  industry_code: number;
  pay_frequency_code: number;
  start_epoch: number;
  end_epoch: number;
  review_epoch: number;
  employer_address: string;
  recordCiphertext: string;
};

function parsePendingAgreement(record: Record<string, unknown>): PendingOffer | null {
  try {
    const plaintext = typeof record.recordPlaintext === "string" ? record.recordPlaintext : null;
    const recordName = typeof record.recordName === "string" ? record.recordName : null;
    const spent = typeof record.spent === "boolean" ? record.spent : false;

    if (!plaintext || recordName !== "PendingAgreement") return null;
    if (spent) return null;

    const empHashMatch = plaintext.match(/employer_name_hash:\s*(\d+)field/);
    const wrkHashMatch = plaintext.match(/worker_name_hash:\s*(\d+)field/);
    const industryMatch = plaintext.match(/industry_code:\s*(\d+)u8/);
    const payFreqMatch = plaintext.match(/pay_frequency_code:\s*(\d+)u8/);
    const startMatch = plaintext.match(/start_epoch:\s*(\d+)u32/);
    const endMatch = plaintext.match(/end_epoch:\s*(\d+)u32/);
    const reviewMatch = plaintext.match(/review_epoch:\s*(\d+)u32/);
    const empAddrMatch = plaintext.match(/employer_address:\s*(aleo1[a-z0-9]+)/);

    // Parse agreement_id bytes
    const aidSection = plaintext.match(/agreement_id:\s*\[([\s\S]*?)\]/);
    let agreementId = "unknown";
    if (aidSection?.[1]) {
      const byteMatches = aidSection[1].match(/(\d+)u8/g);
      if (byteMatches) {
        agreementId = byteMatches.map(m => parseInt(m).toString(16).padStart(2, "0")).join("");
      }
    }

    if (!empHashMatch?.[1] || !empAddrMatch?.[1]) return null;

    return {
      agreement_id: agreementId,
      employer_name_hash: empHashMatch[1],
      worker_name_hash: wrkHashMatch?.[1] ?? "",
      industry_code: parseInt(industryMatch?.[1] ?? "0"),
      pay_frequency_code: parseInt(payFreqMatch?.[1] ?? "0"),
      start_epoch: parseInt(startMatch?.[1] ?? "0"),
      end_epoch: parseInt(endMatch?.[1] ?? "0"),
      review_epoch: parseInt(reviewMatch?.[1] ?? "0"),
      employer_address: empAddrMatch[1] ?? "",
      recordCiphertext: typeof record.recordCiphertext === "string" ? record.recordCiphertext : "",
    };
  } catch {
    return null;
  }
}

export default function WorkerOffersPage() {
  const { address } = useAleoSession();
  const { requestRecords } = useWallet();
  const { execute, isExecuting, error: txError, status: txStatus } = useTransactionExecutor();

  const [offers, setOffers] = useState<PendingOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<PendingOffer | null>(null);
  const [acceptTxId, setAcceptTxId] = useState<string | null>(null);
  const [decryptedTerms, setDecryptedTerms] = useState<string | null>(null);
  const [termsLoading, setTermsLoading] = useState(false);
  const [employerName, setEmployerName] = useState<string | null>(null);

  const scanForOffers = useCallback(async () => {
    if (!requestRecords) return;
    setIsLoading(true);

    try {
      console.log("[PNW] Scanning wallet for PendingAgreement records...");
      const records = await requestRecords(PROGRAMS.layer1.employer_agreement, true);
      console.log("[PNW] Agreement records from wallet:", records);

      if (Array.isArray(records)) {
        const parsed: PendingOffer[] = [];
        for (const rec of records) {
          const offer = parsePendingAgreement(rec as Record<string, unknown>);
          if (offer) parsed.push(offer);
        }
        setOffers(parsed);
        console.log("[PNW] Parsed pending offers:", parsed.length);
      }
    } catch (err) {
      console.warn("[PNW] Failed to scan for offers:", err);
    } finally {
      setIsLoading(false);
    }
  }, [requestRecords]);

  useEffect(() => {
    void scanForOffers();
  }, [scanForOffers]);

  async function handleAccept(offer: PendingOffer) {
    // Compute accept_time_hash
    const ts = Math.floor(Date.now() / 1000);
    const tsBytes = new Uint8Array(4);
    tsBytes[0] = (ts >>> 24) & 0xff;
    tsBytes[1] = (ts >>> 16) & 0xff;
    tsBytes[2] = (ts >>> 8) & 0xff;
    tsBytes[3] = ts & 0xff;

    const data = tlvEncode(0x6008, [
      { tag: 0x01, value: tsBytes },
    ]);
    const hashBytes = domainHash(DOMAIN_TAGS.DOC, data);
    const acceptTimeHash = "[ " + Array.from(hashBytes).map(b => `${b}u8`).join(", ") + " ]";

    console.log("[PNW] Accepting offer, record ciphertext:", offer.recordCiphertext.slice(0, 60) + "...");

    const result = await execute(
      PROGRAMS.layer1.employer_agreement,
      "accept_job_offer",
      [offer.recordCiphertext, acceptTimeHash],
    );

    if (result.status === "confirmed") {
      setAcceptTxId(result.txId);
      setOffers(prev => prev.filter(o => o.agreement_id !== offer.agreement_id));
      setSelectedOffer(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Job Offers</h1>
          <p className="text-sm text-muted-foreground">
            Pending employment offers from employers
          </p>
        </div>
        <button
          onClick={() => void scanForOffers()}
          disabled={isLoading}
          className="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          {isLoading ? "Scanning..." : "Refresh"}
        </button>
      </div>

      {acceptTxId && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <p className="text-sm text-green-400 font-medium">Offer Accepted!</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Employment agreement is now active. TX: <span className="font-mono">{acceptTxId.slice(0, 24)}...</span>
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Scanning wallet for pending offers...</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No pending offers found.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            When an employer sends you a job offer, it will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <div key={offer.agreement_id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Job Offer from{" "}
                    <span className="font-mono text-xs">
                      {offer.employer_address.slice(0, 14)}...{offer.employer_address.slice(-6)}
                    </span>
                  </p>
                  <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                    <span>{INDUSTRY_SUFFIXES[offer.industry_code]?.label ?? `Industry ${offer.industry_code}`}</span>
                    <span>{PAY_FREQUENCY_LABELS[offer.pay_frequency_code as keyof typeof PAY_FREQUENCY_LABELS] ?? "—"}</span>
                    <span>Epoch {offer.start_epoch} → {offer.end_epoch || "open"}</span>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Pending
                </span>
              </div>

              {selectedOffer?.agreement_id === offer.agreement_id ? (
                <div className="space-y-3">
                  {/* Employer identity */}
                  {employerName && (
                    <div className="rounded-md bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">
                        From: <span className="text-foreground font-medium">{employerName}.pnw</span>
                      </p>
                    </div>
                  )}

                  {/* Agreement terms (when available) */}
                  {decryptedTerms ? (
                    <div className="rounded-md border border-border bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Agreement Terms
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {decryptedTerms}
                      </p>
                    </div>
                  ) : termsLoading ? (
                    <div className="rounded-md border border-border bg-background p-3 text-center">
                      <p className="text-xs text-muted-foreground">Loading agreement terms...</p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-xs text-amber-300">
                        Agreement terms will be viewable once the terms vault is connected.
                        The terms are encrypted and stored on IPFS — only you can read them.
                      </p>
                    </div>
                  )}

                  <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                    <p className="text-xs text-blue-300">
                      By accepting, you enter into a private employment agreement on the Aleo blockchain.
                      Only you and the employer can see the terms.
                    </p>
                  </div>

                  {isExecuting && (
                    <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <p className="text-xs text-primary">
                        {txStatus === "submitting" ? "Submitting..." : "Waiting for confirmation..."}
                      </p>
                    </div>
                  )}

                  {txError && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
                      <p className="text-xs text-red-400">{txError}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedOffer(null)}
                      disabled={isExecuting}
                      className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAccept(offer)}
                      disabled={isExecuting}
                      className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      {isExecuting ? "Accepting..." : "Accept Offer"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setSelectedOffer(offer);
                    setDecryptedTerms(null);
                    setEmployerName(null);
                    setTermsLoading(true);

                    // Resolve employer .pnw name
                    if (offer.employer_name_hash) {
                      const name = await queryNamePlaintext(offer.employer_name_hash);
                      if (name) setEmployerName(name);
                    }

                    // Fetch and decrypt terms from IPFS
                    try {
                      const cid = await lookupTermsCid(offer.agreement_id);
                      if (cid && address && offer.employer_address) {
                        const encrypted = await fetchEncryptedTerms(cid);
                        const terms = await decryptTerms(
                          encrypted,
                          offer.agreement_id,
                          offer.employer_address,
                          address,
                        );
                        setDecryptedTerms(terms);
                      }
                    } catch (err) {
                      console.warn("[PNW] Failed to fetch/decrypt terms:", err);
                    } finally {
                      setTermsLoading(false);
                    }
                  }}
                  className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Review & Accept
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
