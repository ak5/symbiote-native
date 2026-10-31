set pagination off
set confirm off
set debuginfod enabled off
handle SIGSEGV stop print pass
handle SIGABRT stop print pass
handle SIGPIPE nostop noprint pass
handle SIGUSR1 nostop noprint pass
handle SIGUSR2 nostop noprint pass
echo SYMBIOTE_NATIVE_DEBUGGER_READY\n
continue
python
# A failed inspection must still let the original signal reach the sanitizer.
if gdb.selected_inferior().pid:
    for command in (
        'info program',
        'info registers',
        'x/16i $pc-24',
        'bt 30',
        'print (unsigned long) __tsan_testonly_shadow_stack_current_size()',
        'thread apply all bt 8',
    ):
        try:
            gdb.execute(command)
        except gdb.error as error:
            gdb.write(f'Native crash inspection unavailable: {error}\n')
    gdb.execute('continue')
end
