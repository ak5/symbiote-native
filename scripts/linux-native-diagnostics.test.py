"""Check native crash address rebasing without requiring a Linux GUI."""

from pathlib import Path
import runpy
import tempfile
from types import SimpleNamespace
import unittest


native_image_base = runpy.run_path(
    str(Path(__file__).with_name('check-linux-accessibility.py')))['native_image_base']


class NativeImageBaseTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='native-symbols-')
        self.addCleanup(self.directory.cleanup)
        self.executable = Path(self.directory.name) / 'native window'

    def header(self, kind):
        data = bytearray(18)
        data[:6] = b'\x7fELF\x02\x01'
        data[16:18] = kind.to_bytes(2, 'little')
        self.executable.write_bytes(data)

    def test_pie_mapping_matches_exact_path_and_preserves_spaces(self):
        self.header(3)
        mappings = ('550000000000-550000001000 r--p 00000000 00:00 1 /other/native window\n'
                    f'560000002000-560000005000 r-xp 00002000 00:00 2 {self.executable}\n')
        self.assertEqual(native_image_base(self.executable, mappings), 0x560000000000)

    def test_fixed_address_executable_keeps_its_symbol_addresses(self):
        self.header(2)
        self.assertEqual(native_image_base(self.executable, ''), 0)

    def test_missing_image_does_not_guess_a_base(self):
        self.header(3)
        with self.assertRaisesRegex(ValueError, 'absent'):
            native_image_base(self.executable, '560000000000-560000001000 rw-p 00000000 00:00 0\n')

    def test_non_elf_image_is_rejected(self):
        self.executable.write_text('#!/bin/sh\n')
        with self.assertRaisesRegex(ValueError, 'ELF header'):
            native_image_base(self.executable, '')

    def test_unlinked_elf_object_is_not_treated_as_a_loaded_executable(self):
        self.header(1)
        with self.assertRaisesRegex(ValueError, 'Unsupported native ELF type'):
            native_image_base(self.executable, '')

    def test_big_endian_elf_type_is_read_with_its_declared_byte_order(self):
        self.header(2)
        data = bytearray(self.executable.read_bytes())
        data[5] = 2
        data[16:18] = (2).to_bytes(2, 'big')
        self.executable.write_bytes(data)
        self.assertEqual(native_image_base(self.executable, ''), 0)


class NativeCrashDebuggerTest(unittest.TestCase):
    def inspect(self, pid):
        commands = []
        reports = []

        def execute(command):
            commands.append(command)
            if command == 'info registers':
                raise RuntimeError('registers unavailable')

        debugger = SimpleNamespace(selected_inferior=lambda: SimpleNamespace(pid=pid),
                                   execute=execute, error=RuntimeError, write=reports.append)
        script = Path(__file__).with_name('linux-native-crash.gdb').read_text()
        python = script.split('\npython\n', 1)[1].rsplit('\nend', 1)[0]
        exec(compile(python, 'linux-native-crash.gdb', 'exec'), {'gdb': debugger})
        return commands, reports

    def test_inspection_error_preserves_signal_delivery(self):
        commands, reports = self.inspect(123)
        self.assertTrue(reports)
        self.assertIn('thread apply all bt 8', commands)
        self.assertEqual(commands[-1], 'continue')

    def test_clean_exit_does_not_inspect_a_missing_inferior(self):
        self.assertEqual(self.inspect(0), ([], []))


class ShadowStackExitCheckTest(unittest.TestCase):
    def setUp(self):
        self.enable = runpy.run_path(str(Path(__file__).with_name(
            'build-linux-tsan-runtime.py')))['enable_exit_check']
        self.check = 'DCHECK_GT(thr->shadow_stack_pos, thr->shadow_stack);'

    def test_only_the_exit_bound_check_is_promoted(self):
        header = f'prefix\n{self.check}\nDCHECK_LT(pos, end);\nsuffix\n'
        patched = self.enable(header)
        self.assertEqual(patched, header.replace('DCHECK_GT', 'CHECK_GT'))
        self.assertIn('DCHECK_LT(pos, end);', patched)

    def test_changed_or_ambiguous_source_is_rejected(self):
        for header in ('unrelated source', self.check + self.check):
            with self.subTest(header=header):
                with self.assertRaisesRegex(RuntimeError, 'exactly one source site'):
                    self.enable(header)


if __name__ == '__main__':
    unittest.main()
