import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Integration tests hit the real DB — run them serially so seeds don't collide
    singleFork: true,
    // Give each suite a generous timeout (DB round-trips)
    testTimeout: 30_000,
  },
});
