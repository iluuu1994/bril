import { Program } from "../bril-ts/bril.ts";
import { readStdin } from "../bril-ts/util.ts";
import { build_cfg, cfg_to_function } from "./build_cfg.ts";
import { global_dce, local_dce } from "./dce.ts";
import { lvn } from "./lvn.ts";

const input = await readStdin();
const program: Program = JSON.parse(input);

for (const f of program.functions) {
    const cfg = build_cfg(f);

    let changed: boolean;
    do {
        changed = false;
        changed ||= lvn(cfg);
        changed ||= global_dce(cfg);
        changed ||= local_dce(cfg);
    } while (changed);

    cfg_to_function(f, cfg);
}

console.log(JSON.stringify(program, null, 2));
