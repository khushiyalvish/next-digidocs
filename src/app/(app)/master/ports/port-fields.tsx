import { FieldError, TextField } from "@/components/forms/action-form";
import { cx } from "@/components/ui/cx";
import { controlHeight, inputClasses } from "@/components/ui/primitives";
import { PORT_KIND_LABELS, PORT_KINDS } from "@/features/masters/schemas";
import type { PortDto } from "@/features/masters/queries";

/** The fields of a port, shared by "Add port" and the port's page. */
export function PortFields({ port }: { port?: PortDto }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <TextField name="portName" label="Port name" defaultValue={port?.portName} autoComplete="off" required />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="portKind" className="block text-sm font-medium text-ink">
          Type
        </label>
        <select id="portKind" name="portKind" defaultValue={port?.portKind ?? "sea"} className={cx(inputClasses, controlHeight, "pr-8")}>
          {PORT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {PORT_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
        <FieldError name="portKind" />
      </div>
    </div>
  );
}
