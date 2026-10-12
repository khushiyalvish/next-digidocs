import { TextField } from "@/components/forms/action-form";
import type { AgentDto } from "@/features/masters/queries";

/** The fields of a clearing agent, shared by "Add Agent" and the agent's page. */
export function AgentFields({ agent }: { agent?: AgentDto }) {
  return (
    <>
      <TextField name="agentName" label="Agent name" defaultValue={agent?.agentName} autoComplete="off" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="email" label="Email" type="email" defaultValue={agent?.email ?? ""} autoComplete="off" required />
        <TextField
          name="phoneNumber"
          label="Phone number"
          type="tel"
          hint="7 to 15 digits"
          defaultValue={agent?.phoneNumber ?? ""}
          autoComplete="off"
          required
        />
      </div>
    </>
  );
}
