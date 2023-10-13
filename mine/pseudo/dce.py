def global_dce:
    used = {}

    for blocks as block:
        for block.instrs as instr:
            if instr.args:
                for instr.args as arg:
                    used.add(arg)

    for blocks as block:
        for block.instrs as instr:
            if instr.dest and not used.contains(instr.dest)
                block.remove(instr)

def local_dce:
    for blocks as block:
        defined = {}

        for block.instrs.reverse() as instr:
            if instr.dest:
                if defined.contains(instr.dest):
                    block.remove(instr)
                    continue
                else:
                    defined.add(instr.dest)
            if instr.args:
                for instr.args as arg:
                    defined.remove(arg)
