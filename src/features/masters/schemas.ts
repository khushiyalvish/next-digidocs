import { z } from "zod";
import { checkboxSchema, idSchema } from "@/lib/schemas";

/*
 * Input of the Master screens (banks, clearing agents, ports), with the rules of old DigiDocs as
 * D:\Khushiyal\DigidocsNext keeps them: names required; an agent's email valid and at most 50
 * characters, phone 7–15 digits; a port is a sea port or an airport.
 */

const nameField = (what: string, max = 300) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(z.string().min(1, `Enter the ${what}`).max(max, `Use at most ${max} characters`));

export const bankSchema = z.object({ bankName: nameField("bank's name") });
export const updateBankSchema = bankSchema.extend({ bankId: idSchema, isActive: checkboxSchema });

export const agentSchema = z.object({
  agentName: nameField("agent's name"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address").max(50, "Use at most 50 characters")),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, "Use 7 to 15 digits (a leading + is allowed)"),
});
export const updateAgentSchema = agentSchema.extend({ agentId: idSchema, isActive: checkboxSchema });

export const PORT_KINDS = ["sea", "air"] as const;
export type PortKind = (typeof PORT_KINDS)[number];
export const PORT_KIND_LABELS: Record<PortKind, string> = { sea: "Sea port", air: "Airport" };

export const portSchema = z.object({
  portName: nameField("port's name"),
  portKind: z.enum(PORT_KINDS, "Choose sea port or airport"),
});
export const updatePortSchema = portSchema.extend({ portId: idSchema, isActive: checkboxSchema });

export type BankFields = z.infer<typeof bankSchema>;
export type AgentFields = z.infer<typeof agentSchema>;
export type PortFields = z.infer<typeof portSchema>;

/** A Master list's address-bar filters. Anything malformed falls back to "no filter". */
export const masterListFilterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
  kind: z.enum(PORT_KINDS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type MasterListFilter = z.infer<typeof masterListFilterSchema>;
