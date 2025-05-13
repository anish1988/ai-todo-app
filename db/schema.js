import { time } from "console";
import { integer, pgTable, text, timestamp ,boolean} from "drizzle-orm/pg-core";


export const todoTable = pgTable("todos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  todo: text().notNull(),
  createdAt: timestamp('creeated_at').defaultNow(),
  updatedAt: timestamp('updated_at').$onUpdate(() => new Date()),
  completed: boolean().default(false),
  
});
