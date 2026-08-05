---
name: Drizzle raw SQL array binding
description: How to pass a JS string[] as a PostgreSQL text[] in Drizzle sql`` template tags.
---

## Rule
Never bind a JS array directly as `${arr}::text[]` inside a Drizzle `sql` template — Drizzle spreads the array as a record tuple which PostgreSQL cannot cast.

## Fix
Convert to a PostgreSQL array literal string first, then bind the string:

```typescript
const literal = `{${arr.map(v => `"${v}"`).join(",")}}`;
await db.execute(sql`INSERT INTO t (col) VALUES (${literal}::text[])`);
```

**Why:** Drizzle parameterizes each array element individually as `($1,$2,...)::text[]`, which PostgreSQL interprets as a row/record cast, not an array cast. A single string in `{"a","b"}` format is a valid PG array literal that casts correctly.

**How to apply:** Any raw `sql` template that passes a `text[]` column value — upserts, inserts, updates with array columns.
