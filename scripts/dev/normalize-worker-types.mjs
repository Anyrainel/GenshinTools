import { readFile, rename, writeFile } from "node:fs/promises";

const target = new URL("../../worker-configuration.d.ts", import.meta.url);
const source = await readFile(target, "utf8");
const normalized = source.replace(/[\t ]+$/gm, "");
if (source !== normalized) {
  const temporary = new URL(
    "../../worker-configuration.d.ts.tmp",
    import.meta.url
  );
  await writeFile(temporary, normalized);
  await rename(temporary, target);
}
