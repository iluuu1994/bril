import { Function, Label, Instruction, Ident, Op, ValueOperation, Constant, EffectOperation } from "../bril-ts/bril.ts";

type Block = {
    name: Ident;
    label: Label|undefined;
    instrs: Instruction[];
}

interface Cfg {
    blocks: Block[];
    edges: Map<Ident, Ident[]>;
}

export function is_label(value: Label|Instruction): value is Label {
    return "label" in value;
}

export function is_instruction(value: Label|Instruction): value is Instruction {
    return !is_label(value);
}

export function is_terminator(value: Label|Instruction): value is Instruction {
    return is_instruction(value) && (value.op === "jmp" || value.op === "br" || value.op === "ret");
}

export function has_dest(value: unknown): value is ValueOperation|Constant {
    return typeof value === 'object' && !Array.isArray(value) && value !== null && 'dest' in value;
}

export function has_side_effect(value: unknown): value is EffectOperation {
    return !has_dest(value);
}

export function is_op(value: unknown): value is Op {
    return typeof value === 'object' && !Array.isArray(value) && value !== null && 'args' in value;
}

export function build_cfg(f: Function): Cfg {
    let blocks: Block[] = [];
    const block_map = new Map<Ident, Block>();
    const edges = new Map<Ident, Ident[]>();
    let label_i = 1;

    function build_blocks() {
        let instrs: Instruction[] = [];
        let label: Label|undefined;

        function generate_label(prefix: string, block_map: Map<Ident, Block>): Ident {
            while (true) {
                const label = `${prefix}_${label_i++}`;
                if (block_map[label] === undefined) {
                    return label;
                }
            }
        }

        function end_block() {
            if (instrs.length > 0 || label) {
                const name = label?.label ?? generate_label('unnamed', block_map);
                const block = { name, label, instrs };
                blocks.push(block);
                block_map.set(block.name, block);
                instrs = [];
                label = undefined;
            }
        }

        for (const i of f.instrs) {
            if (!is_label(i)) {
                instrs.push(i);
            }
            if (is_terminator(i) || is_label(i)) {
                end_block();
            }
            if (is_label(i)) {
                label = i;
            }
        }
        end_block();
    }

    function build_edges() {
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const last_instr = block.instrs[block.instrs.length - 1];
            if (!last_instr) {
                continue;
            }
            if (is_terminator(last_instr)) {
                if (last_instr.op === "jmp" || last_instr.op === "br") {
                    edges.set(block.name, last_instr.labels!);
                }
            } else {
                const next_block = blocks[i + 1];
                if (next_block) {
                    edges.set(block.name, [next_block.name]);
                }
            }
        }
        return edges;
    }

    build_blocks();
    build_edges();

    return { blocks, edges };
}

export function cfg_to_function(f: Function, cfg: Cfg) {
    f.instrs = cfg.blocks.flatMap(b => [
        ...(b.label ? [b.label] : []),
        ...b.instrs,
    ]);
}
