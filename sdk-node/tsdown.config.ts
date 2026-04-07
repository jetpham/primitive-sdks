import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/webhook/index.ts"],
  format: ["esm"],
  dts: {
    sourcemap: false,
  },
  clean: true,
  sourcemap: false,
});
