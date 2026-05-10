import { afterEach, describe, expect, it } from "vitest";
import { rmSync, writeFileSync } from "fs";
import { join } from "path";
import bs58 from "bs58";
import { getServerEnv, parseSecretKey } from "./server-wallet";

const validKey = Array.from({ length: 64 }, (_, index) => index);

describe("parseSecretKey", () => {
  afterEach(() => {
    rmSync(join(process.cwd(), ".env.local"), { force: true });
    delete process.env.AGENTSPEND_TEST_VALUE;
  });

  it("parses a JSON byte array", () => {
    expect(Array.from(parseSecretKey(JSON.stringify(validKey)))).toEqual(validKey);
  });

  it("parses a comma-separated byte list", () => {
    expect(Array.from(parseSecretKey(validKey.join(",")))).toEqual(validKey);
  });

  it("parses a Phantom-style base58 secret key", () => {
    const encoded = bs58.encode(Uint8Array.from(validKey));

    expect(Array.from(parseSecretKey(encoded))).toEqual(validKey);
  });

  it("rejects malformed keys", () => {
    expect(() => parseSecretKey("[1,2,3]")).toThrow("64 byte values");
  });

  it("loads server env values from a local env file when process env is absent", () => {
    writeFileSync(join(process.cwd(), ".env.local"), "AGENTSPEND_TEST_VALUE=from-file\n");

    expect(getServerEnv("AGENTSPEND_TEST_VALUE")).toBe("from-file");
  });

  it("prefers process env values over local env files", () => {
    process.env.AGENTSPEND_TEST_VALUE = "from-process";
    writeFileSync(join(process.cwd(), ".env.local"), "AGENTSPEND_TEST_VALUE=from-file\n");

    expect(getServerEnv("AGENTSPEND_TEST_VALUE")).toBe("from-process");
  });
});
