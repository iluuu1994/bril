import { Ident } from "../bril-ts/bril.ts";
import type { Cfg } from "./build_cfg.ts";
import { has_dest, has_side_effect, is_instruction, is_op } from "./build_cfg.ts";

export function global_dce(cfg: Cfg): boolean {
    const used = new Set<Ident>();
    let changed = false;

    for (const block of cfg.blocks) {
        for (const instr of block.instrs) {
            if (is_op(instr)) {
                for (const arg of (instr.args ?? [])) {
                    used.add(arg);
                }
            }
        }
    }

    for (const block of cfg.blocks) {
        for (const instr of block.instrs) {
            if (has_dest(instr) && !has_side_effect(instr) && !used.has(instr.dest)) {
                instr.op = 'nop';
                changed = true;
            }
        }
        block.instrs = block.instrs.filter(i => is_instruction(i) && i.op !== 'nop');
    }

    return changed;
}

export function local_dce(cfg: Cfg): boolean {
    let changed = false;

    for (const block of cfg.blocks) {
        const defined = new Set<Ident>();

        for (let i = block.instrs.length - 1; i >= 0; i--) {
            const instr = block.instrs[i];
            if (has_dest(instr)) {
                if (defined.has(instr.dest) && !has_side_effect(instr)) {
                    instr.op = 'nop';
                    // Avoid removing args of removed instruction from defined to eliminate further
                    // definitions in the same pass.
                    continue;
                } else {
                    defined.add(instr.dest);
                }
            }
            for (const arg of (instr.args ?? [])) {
                defined.delete(arg);
            }
        }
        block.instrs = block.instrs.filter(i => is_instruction(i) && i.op !== 'nop');
    }

    return changed;
}
