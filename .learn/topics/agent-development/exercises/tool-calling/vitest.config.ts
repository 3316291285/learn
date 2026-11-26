import { defineConfig } from "vitest/config";

// 让 vitest 只在本练习目录内收集测试（.learn 是点目录，根目录运行会因 glob 跳过点目录而找不到）
export default defineConfig({
  test: {
    environment: "node",
    include: ["*.test.ts"],
  },
});
