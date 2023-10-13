import { Ident, Instruction, Value } from "../bril-ts/bril.ts";
import type { Cfg } from "./build_cfg.ts";
import { has_side_effect } from "./build_cfg.ts";

interface Numbering {
    number: number;
    name: Ident;
    value?: Value;
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
                name2numbering.set(name, numbering);
            }
            return numbering;
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

            function lookup_expr(expr: string) {
                let numbering = numbering_for_expr(expr);
                invalidate_variable(instr.dest);
                if (numbering) {
                    instr.op = 'id';
                    instr.args = [numbering.name];
                    changed = true;
                } else {
                    numbering = { number: next_number++, name: instr.dest, value: instr.value };
                    numberings.set(expr, numbering);
                }
                name2numbering.set(instr.dest, numbering);
            }

            function attempt_const_eval(args: Numbering[]): boolean {
                if (instr.op === 'add') {
                    instr.value = args[0].value + args[1].value;
                } else if (instr.op === 'mul') {
                    instr.value = args[0].value * args[1].value;
                } else if (instr.op === 'sub') {
                    instr.value = args[0].value - args[1].value;
                } else if (instr.op === 'dif') {
                    instr.value = args[0].value / args[1].value;
                } else if (instr.op === 'eq') {
                    instr.value = args[0].value === args[1].value;
                } else if (instr.op === 'lt') {
                    instr.value = args[0].value < args[1].value;
                    instr.type = 'bool';
                } else if (instr.op === 'gt') {
                    instr.value = args[0].value > args[1].value;
                    instr.type = 'bool';
                } else if (instr.op === 'ge') {
                    instr.value = args[0].value >= args[1].value;
                    instr.type = 'bool';
                } else if (instr.op === 'le') {
                    instr.value = args[0].value <= args[1].value;
                    instr.type = 'bool';
                } else if (instr.op === 'not') {
                    instr.value = !args[0].value;
                    instr.type = 'bool';
                } else if (instr.op === 'and') {
                    instr.value = args[0].value && args[1].value;
                    instr.type = 'bool';
                } else if (instr.op === 'or') {
                    instr.value = args[0].value || args[1].value;
                    instr.type = 'bool';
                } else {
                    return false;
                }
                instr.op = 'const';
                delete instr.args;
                changed = true;
                return true;
            }

            function is_commutative(): boolean {
                return instr.op === 'add' || instr.op === 'mul';
            }

            if (!has_side_effect(instr)) {
                if (instr.op === 'const') {
                    const expr = `const\$${instr.type}\$${JSON.stringify(instr.value)}`;
                    lookup_expr(expr);
                } else if (instr.args) {
                    const args = instr.args.map(arg => num_for_name(arg));
                    if (args.filter(n => n.value === undefined).length === 0
                        && attempt_const_eval(args)) {
                        const expr = `const\$${instr.type}\$${JSON.stringify(instr.value)}`;
                        lookup_expr(expr);
                        continue;
                    } else {
                        if (is_commutative()) {
                            args.sort((l, r) => l.number < r.number ? -1 : 1);
                        }
                        const expr = `${instr.op}\$${args.map(a => a.number).join('$')}`
                        lookup_expr(expr);
                    }
                }
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
