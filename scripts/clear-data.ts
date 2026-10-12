/**
 * Empties chosen parts of a TEST installation's DigiDocs database (hub CHILD-APP-GUIDE.md §5.9).
 * Without --confirm it only shows how many rows each part would delete. Run by a person, never
 * by the application.
 *
 *   npm run data:clear                                                      lists the parts
 *   npm run data:clear -- --clear test-users,sessions                       shows what would go
 *   npm run data:clear -- --clear test-users,sessions --confirm <database>  deletes it
 *
 * Refuses to run unless ALLOW_DATA_CLEAR=true. The parts: src/features/maintenance/clear-parts.ts;
 * the guards: src/lib/data-clear.ts. What is deleted cannot be brought back.
 */
import { runDataClear } from "@/lib/data-clear";
import { CLEAR_PARTS } from "@/features/maintenance/clear-parts";

runDataClear(CLEAR_PARTS)
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
