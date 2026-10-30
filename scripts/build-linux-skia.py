import argparse
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess


def build(host, variant):
    lock = json.loads((host / 'scripts/skia.lock.json').read_text())
    source = host / 'third_party/skia'

    def run(*arguments):
        subprocess.run(arguments, cwd=source, check=True)

    revision = subprocess.check_output(
        ['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
    if revision != lock['headers']['commit']:
        raise RuntimeError('Skia source does not match the host lockfile')
    run('git', 'sparse-checkout', 'disable')

    # Reuse the pinned dependency parser/checkout implementation, one checkout at a time.
    sync = runpy.run_path(str(source / 'tools/git-sync-deps'))
    dependencies = sync['parse_file_to_dict'](source / 'DEPS')['deps']
    for directory, dependency in sorted(dependencies.items()):
        if not isinstance(dependency, str):
            continue
        repository, commit = dependency.rsplit('@', 1)
        if not sync['is_sha1_sum'](commit):
            raise RuntimeError(f'Unpinned Skia dependency: {directory}')
        sync['git_checkout_to_directory'](
            'git', repository, commit, str(source / directory), True, True)
    run('python3', 'bin/fetch-gn')

    sanitizer = 'address,undefined' if variant == 'asan' else 'thread'
    arguments = {
        'cc': os.environ.get('CC', 'clang-18'),
        'cxx': os.environ.get('CXX', 'clang++-18'),
        'cc_wrapper': 'ccache',
        'is_official_build': True,
        'is_debug': False,
        'skia_use_partition_alloc': False,
        'skia_enable_graphite': False,
        'skia_enable_ganesh': True,
        'skia_use_vulkan': True,
        'skia_use_gl': True,
        'skia_use_x11': False,
        'skia_enable_spirv_validation': False,
        'skia_enable_svg': False,
        'skia_enable_skottie': False,
        'skia_use_dng_sdk': False,
        'skia_use_xps': False,
        'skia_use_libwebp_decode': False,
        'skia_use_libwebp_encode': False,
        'skia_use_system_libpng': False,
        'skia_use_system_zlib': False,
        'skia_use_system_libjpeg_turbo': False,
        'skia_use_system_expat': False,
        'skia_enable_skparagraph': True,
        'skia_enable_skshaper': True,
        'skia_use_system_icu': False,
        'skia_use_system_harfbuzz': False,
        'skia_pdf_subset_harfbuzz': True,
        'skia_use_system_freetype2': True,
        'skia_use_freetype_woff2': False,
        # Extra flags follow Skia's no_rtti config; retain UBSan's vptr checks.
        'extra_cflags_cc': ['-frtti'],
        'extra_cflags': [f'-fsanitize={sanitizer}', '-fno-omit-frame-pointer',
                         '-fno-sanitize-recover=all'],
        'extra_ldflags': [f'-fsanitize={sanitizer}'],
    }
    output = f'out/symbiote-{variant}'
    gn_arguments = ' '.join(f'{key}={json.dumps(value)}' for key, value in arguments.items())
    run('bin/gn', 'gen', output, '--fail-on-unused-args', f'--args={gn_arguments}')
    flags = subprocess.check_output(
        ['bin/gn', 'desc', output, '//:skia', 'cflags_cc', '--format=json'],
        cwd=source, text=True)
    effective = json.loads(flags)['//:skia']['cflags_cc']
    rtti = [flag for flag in effective if flag in ('-frtti', '-fno-rtti')]
    if not rtti or rtti[-1] != '-frtti':
        raise RuntimeError('Skia must retain RTTI for sanitizer type checks')
    modules = ['skia', 'skparagraph', 'skshaper', 'skunicode_icu', 'skunicode_core']
    run('ninja', '-C', output, '-j', '2', *modules)
    for module in modules:
        shutil.copyfile(source / output / f'lib{module}.a', source / 'lib' / f'lib{module}.a')
    (source / '.vendor-stamp.json').unlink(missing_ok=True)
    (source / '.source-sanitizer.json').write_text(
        json.dumps({'revision': revision, 'arguments': arguments}, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Build the pinned Skia with native sanitizers and RTTI')
    parser.add_argument('host', type=Path)
    parser.add_argument('variant', choices=('asan', 'tsan'))
    options = parser.parse_args()
    build(options.host.resolve(), options.variant)
