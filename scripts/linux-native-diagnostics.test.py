"""Check native crash address rebasing without requiring a Linux GUI."""

from pathlib import Path
import runpy
import tempfile
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


if __name__ == '__main__':
    unittest.main()
