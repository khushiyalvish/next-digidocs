import { describe, expect, it } from "vitest";
import { agentSchema, bankSchema, masterListFilterSchema, portSchema, updatePortSchema } from "@/features/masters/schemas";

/* Pins the Master screens' input rules (old DigiDocs's, as D:\Khushiyal\DigidocsNext keeps them). */

describe("banks", () => {
  it("needs a name, and tidies its spaces", () => {
    expect(bankSchema.parse({ bankName: "  First   Bank  " })).toEqual({ bankName: "First Bank" });
    expect(bankSchema.safeParse({ bankName: "   " }).success).toBe(false);
  });
});

describe("clearing agents", () => {
  const agent = { agentName: "AAA Logistics", email: "Ops@AAA.com ", phoneNumber: "08012345678" };

  it("accepts a valid agent and lower-cases the email", () => {
    expect(agentSchema.parse(agent)).toEqual({ agentName: "AAA Logistics", email: "ops@aaa.com", phoneNumber: "08012345678" });
    expect(agentSchema.safeParse({ ...agent, phoneNumber: "+2348012345678" }).success).toBe(true);
  });

  it("refuses a bad email, an email over 50 characters, and a phone that is not 7–15 digits", () => {
    expect(agentSchema.safeParse({ ...agent, email: "not-an-email" }).success).toBe(false);
    expect(agentSchema.safeParse({ ...agent, email: `${"a".repeat(45)}@x.com` }).success).toBe(false);
    for (const phoneNumber of ["123456", "1234567890123456", "080-1234-567", ""]) {
      expect(agentSchema.safeParse({ ...agent, phoneNumber }).success, phoneNumber).toBe(false);
    }
  });
});

describe("ports", () => {
  it("is a sea port or an airport, nothing else", () => {
    expect(portSchema.parse({ portName: "Apapa", portKind: "sea" }).portKind).toBe("sea");
    expect(portSchema.safeParse({ portName: "Apapa", portKind: "border" }).success).toBe(false);
  });

  it("reads an unticked Active box as deactivate", () => {
    const id = "0A000000-0000-4000-8000-000000000001";
    expect(updatePortSchema.parse({ portId: id, portName: "Apapa", portKind: "air" }).isActive).toBe(false);
  });
});

describe("Master list filters", () => {
  it("fall back to no filter for anything malformed", () => {
    expect(masterListFilterSchema.parse({ status: "gone", kind: "border", page: "0" })).toEqual({ page: 1 });
  });
});
