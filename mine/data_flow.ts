import { Program, Function, Ident } from "../bril-ts/bril.ts";
import { readStdin } from "../bril-ts/util.ts";
import { Cfg, Block, build_cfg, has_dest, is_op } from "./build_cfg.ts";

function set_equals<Value>(l: Set<Value>, r: Set<Value>) {
    return l.size === r.size
        && [...l].every((x) => r.has(x));
}

function compute_live_ranges(f: Function) {
    const cfg = build_cfg(f);
    return reverse_work_list(
        cfg,
        (b, out) => {
            out = new Set(out);
            for (const instr of b.instrs.slice().reverse()) {
                if (has_dest(instr)) {
                    out.delete(instr.dest);
                }
                if (is_op(instr)) {
                    for (const arg of instr.args!) {
                        out.add(arg);
                    }
                }
            }
            return out;
        },
        (ins) => {
            const new_ins = new Set();
            for (const values of ins) {
                for (const value of values) {
                    new_ins.add(value);
                }
            }
            return new_ins;
        }
    );
}

function reverse_work_list<Value>(
    cfg: Cfg,
    transfer: (b: Block, out: Set<Value>) => Set<Value>,
    merge: (ins: Set<Value>[]) => Set<Value>
) {
    const in_: Map<string, Set<Value>> = new Map();
    const out: Map<string, Set<Value>> = new Map();
    const block_map = new Map(cfg.blocks.map(b => [b.name, b]));
    const worklist: Set<string> = new Set(cfg.blocks.map(b => b.name));
    while (worklist.size) {
        const block_name = worklist.values().next().value;
        worklist.delete(block_name);
        const block = block_map.get(block_name)!;
        let changed = false;

        const out_before = out.get(block_name) ?? new Set();
        const out_after = merge(cfg.edges.get(block_name)?.map(e => in_.get(e) ?? new Set()) ?? []);
        if (!set_equals(out_before, out_after)) {
            out.set(block_name, out_after);
            changed = true;
        }

        const in_before = in_.get(block_name) ?? new Set();
        const in_after = transfer(block, out.get(block_name) ?? new Set());
        if (!set_equals(in_before, in_after)) {
            in_.set(block_name, in_after);
            changed = true;
        }

        if (changed) {
            for (const [from, to] of cfg.edges) {
                if (to.indexOf(block_name) !== -1) {
                    worklist.add(from);
                }
            }
        }
    }

    return {in_, out};
}

const input = await readStdin();
const program: Program = JSON.parse(input);

for (const f of program.functions) {
    const live_ranges = compute_live_ranges(f);
    console.log(live_ranges);
}
