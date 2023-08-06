import { Ident, Instruction } from "../bril-ts/bril.ts";
import type { Cfg } from "./build_cfg.ts";
import { has_side_effect } from "./build_cfg.ts";

interface Numbering {
    number: number;
    name: Ident;
}

export function lvn(cfg: Cfg): boolean {
    let changed = false;

    for (const block of cfg.blocks) {
        let numberings = new Map<string, Numbering>();
        const name2numbering = new Map<Ident, Numbering>();
        let next_number = 1;

        function num_for_name(name: Ident): Numbering {
            let numbering = name2numbering.get(name);
            if (!numbering) {
                numbering = {number: next_number++, name};
            }
            return numbering;
        }

        function instr_to_expr(instr: Instruction) {
            if (instr.op === 'const') {
                return `const\$${instr.type}\$${JSON.stringify(instr.value)}`;
            } else if (instr.args && !has_side_effect(instr)) {
                let expr = `${instr.op}`;
                for (const arg of instr.args) {
                    expr += `\$${num_for_name(arg).number}`;
                }
                return expr;
            } else {
                return undefined;
            }
        }

        function numbering_for_expr(expr: string): Numbering|undefined {
            return numberings.get(expr);
        }

        function invalidate_variable(name: Ident) {
            name2numbering.delete(name);
            name2numbering.forEach((n, key) => {
                if (n.name === name) {
                    name2numbering.delete(key);
                }
            });
            numberings.forEach((n, expr) => {
                if (n.name === name) {
                    numberings.delete(expr);
                }
            });
        }

        for (const instr of block.instrs) {
            if (instr.op === 'id') {
                const alias = instr.args![0];
                const numbering = num_for_name(alias);
                invalidate_variable(instr.dest);
                name2numbering.set(instr.dest, numbering);
                if (numbering.name !== alias) {
                    instr.args![0] = numbering.name;
                    changed = true;
                }
                continue;
            }

            const expr = instr_to_expr(instr);
            if (expr) {
                let numbering = numbering_for_expr(expr);
                invalidate_variable(instr.dest);
                if (numbering) {
                    instr.op = 'id';
                    instr.args = [numbering.name];
                    changed = true;
                } else {
                    numbering = { number: next_number++, name: instr.dest };
                    numberings.set(expr, numbering);
                }
                name2numbering.set(instr.dest, numbering);
            }
            if (instr.args) {
                for (const [i, arg] of instr.args.entries()) {
                    const numbering = num_for_name(arg);
                    if (numbering && arg !== numbering.name) {
                        instr.args[i] = numbering.name;
                        changed = true;
                    }
                }
            }
            if (instr.dest && has_side_effect(instr)) {
                invalidate_variable(instr.dest);
            }
        }
    }

    return changed;
}
