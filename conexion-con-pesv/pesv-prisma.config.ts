import { defineConfig } from "prisma/config";
import path from "node:path";

export default defineConfig({
  schema: path.join("prisma", "pesv-schema.prisma"),
  datasource: {
    url: process.env.PESV_DATABASE_URL || "mysql://root:rootsecret@localhost:3306/pesv_dev_db",
  },
});
