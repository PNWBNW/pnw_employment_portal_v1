import { describe, it, expect } from "vitest";
import { formatUSDCx, formatUSDCxShort } from "./usdcx_scanner";

describe("USDCx formatters", () => {
  it("formatUSDCx: zero", () => {
    expect(formatUSDCx(0n)).toBe("$0.00");
  });

  it("formatUSDCx: whole dollar", () => {
    expect(formatUSDCx(1_000_000n)).toBe("$1.00");
  });

  it("formatUSDCx: fractional amount", () => {
    expect(formatUSDCx(1_234_567n)).toBe("$1.234567");
  });

  it("formatUSDCx: large amount", () => {
    expect(formatUSDCx(1_000_000_000_000n)).toBe("$1,000,000.00");
  });

  it("formatUSDCxShort: zero", () => {
    expect(formatUSDCxShort(0n)).toBe("$0.00");
  });

  it("formatUSDCxShort: rounds to cents", () => {
    expect(formatUSDCxShort(1_234_567n)).toBe("$1.23");
  });

  it("formatUSDCxShort: exact dollar", () => {
    expect(formatUSDCxShort(5_000_000n)).toBe("$5.00");
  });
});
