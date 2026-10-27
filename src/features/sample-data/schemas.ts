import { z } from "zod";
import { CONTAINER_SIZES, SHIPPING_MODES, type ContainerSize, type ShippingMode } from "@/features/imports/form";
import { MAX_REASON_LENGTH, type ReviewDecision } from "@/features/workflow/review";
import { REJECTED_STATUSES, type StatusKey } from "@/features/workflow/statuses";

/*
 * The sample data `npm run db:seed` loads (database/seed/sample-data.json; hub CHILD-APP-GUIDE.md
 * §5.10): imports owned by the test team's Enterprise users, one of each status the workflow
 * reaches, taken there by the test team's LFZ Admin and NEPZA user. The file holds reference data
 * by its old ids and codes (migrations 0004–0005), never database ids, and day offsets, never dates.
 *
 * Pure: no database. The seed is features/sample-data/seed.ts.
 */

export const SAMPLE_DATA_FILE = "database/seed/sample-data.json";

/** The statuses an import reaches in the new workflow (features/workflow/review.ts). Saved by LFTZ / NEPZA and Enterprise Submit are old statuses nothing moves to. */
export const SAMPLE_STATUSES = [
  "draft",
  "submitted",
  "lfz_rejected",
  "lfz_approved",
  "nepza_rejected",
  "nepza_approved",
  "nepza_letter_rejected",
  "completed",
] as const satisfies readonly StatusKey[];

export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

export interface SampleReview {
  role: "lfz_admin" | "nepza";
  decision: ReviewDecision;
}

const LFZ_APPROVE: SampleReview = { role: "lfz_admin", decision: "approve" };
const NEPZA_APPROVE: SampleReview = { role: "nepza", decision: "approve" };

/** The review steps after submission that take an import to each status (none for a draft: it is not submitted). */
export const SAMPLE_PATHS: Record<SampleStatus, readonly SampleReview[]> = {
  draft: [],
  submitted: [],
  lfz_rejected: [{ role: "lfz_admin", decision: "reject" }],
  lfz_approved: [LFZ_APPROVE],
  nepza_rejected: [LFZ_APPROVE, { role: "nepza", decision: "reject" }],
  nepza_approved: [LFZ_APPROVE, NEPZA_APPROVE],
  nepza_letter_rejected: [LFZ_APPROVE, NEPZA_APPROVE, { role: "lfz_admin", decision: "reject_nepza_letter" }],
  completed: [LFZ_APPROVE, NEPZA_APPROVE, { role: "lfz_admin", decision: "final_approve" }],
};

/** The timeline steps a sample import gets: created, submitted (not for a draft), then its reviews. */
export function sampleStepCount(status: SampleStatus): number {
  return status === "draft" ? 1 : 2 + SAMPLE_PATHS[status].length;
}

export const SAMPLE_TRACKING_PATTERN = /^SAMPLE-\d{4}$/;

const money = z.number().min(0).max(1e12);

const sampleItemSchema = z.object({
  name: z.string().trim().min(1).max(300),
  /** hse_codes.hse_code */
  hseCode: z.string().regex(/^\d{10}$/, "A 10-digit HSE code"),
  /** measurement_units.legacy_id */
  unitLegacyId: z.number().int().positive(),
  quantity: z.number().positive().max(1e9),
  fob: money.positive(),
});

const sampleShipmentSchema = z.object({
  /** transaction_types.legacy_id of an import Particular: 3 Sea Container Import, 17 Air Shipment. */
  particularLegacyId: z.union([z.literal(3), z.literal(17)]),
  shippingMode: z.enum(Object.keys(SHIPPING_MODES) as [ShippingMode, ...ShippingMode[]]),
  /** countries.legacy_id, ports.legacy_id, clearing_agents.legacy_id */
  countryLegacyId: z.number().int().positive(),
  portLegacyId: z.number().int().positive(),
  clearingAgentLegacyId: z.number().int().positive(),
  /** currencies.iso_code */
  currency: z.string().regex(/^[A-Z]{3}$/),
  freight: money,
  insurance: money,
  airQuantity: z.number().positive().nullable(),
  totalCbm: z.number().positive().nullable(),
  description: z.string().trim().min(1).max(4000),
  supplier: z.string().trim().min(1).max(500),
  containerSizes: z.array(z.enum(Object.keys(CONTAINER_SIZES) as [ContainerSize, ...ContainerSize[]])),
  items: z.array(sampleItemSchema).min(1),
});

const sampleImportSchema = z.object({
  trackingNumber: z.string().regex(SAMPLE_TRACKING_PATTERN, "SAMPLE-NNNN"),
  /** The owner's hub id: an Enterprise user in database/seed/test-users.json. */
  ownerId: z.guid().transform((id) => id.toLowerCase()),
  shipment: z.string().min(1),
  status: z.enum(SAMPLE_STATUSES),
  /** Created this many days ago; each later step a day after the one before. */
  daysAgo: z.number().int().min(1).max(90),
  /** The rejection's reason, which the list shows as Remarks: for a rejected status only. */
  reason: z.string().trim().min(1).max(MAX_REASON_LENGTH).nullable(),
});

export const sampleDataFileSchema = z
  .object({
    shipments: z.record(z.string(), sampleShipmentSchema),
    imports: z.array(sampleImportSchema).min(1),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.imports.forEach((sample, index) => {
      const at = (field: string) => ["imports", index, field];
      if (seen.has(sample.trackingNumber)) ctx.addIssue({ code: "custom", path: at("trackingNumber"), message: "Used twice" });
      seen.add(sample.trackingNumber);
      if (!file.shipments[sample.shipment]) ctx.addIssue({ code: "custom", path: at("shipment"), message: "No such shipment in the file" });
      const rejected = (REJECTED_STATUSES as readonly StatusKey[]).includes(sample.status);
      if (rejected !== (sample.reason !== null)) {
        ctx.addIssue({ code: "custom", path: at("reason"), message: rejected ? "A rejection needs a reason" : "Only a rejection has a reason" });
      }
      // The last step must be at least a day ago, not in the future.
      if (sample.daysAgo < sampleStepCount(sample.status)) {
        ctx.addIssue({ code: "custom", path: at("daysAgo"), message: `At least ${sampleStepCount(sample.status)} for this status` });
      }
    });
  });

export type SampleDataFile = z.infer<typeof sampleDataFileSchema>;
export type SampleShipment = SampleDataFile["shipments"][string];
export type SampleImport = SampleDataFile["imports"][number];
