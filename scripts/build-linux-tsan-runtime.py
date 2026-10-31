"""Build LLVM's pinned TSan runtime with its shadow-stack assertions enabled."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
import urllib.request


ARCHIVES = {
    'compiler-rt': 'e054e99a9c9240720616e927cb52363abbc8b4f1ef0286bad3df79ec8fdf892f',
    'cmake': '59badef592dd34893cd319d42b323aaa990b452d05c7180ff20f23ab1b41e837',
}


def build(host):
    workspace = host / 'build/tsan-runtime'
    workspace.mkdir(parents=True, exist_ok=False)
    for name, checksum in ARCHIVES.items():
        filename = f'{name}-18.1.8.src.tar.xz'
        url = f'https://github.com/llvm/llvm-project/releases/download/llvmorg-18.1.8/{filename}'
        with urllib.request.urlopen(url, timeout=30) as response:
            content = response.read(10_000_001)
        if hashlib.sha256(content).hexdigest() != checksum:
            raise RuntimeError(f'Pinned LLVM source checksum mismatch: {filename}')
        archive = workspace / filename
        archive.write_bytes(content)
        with tarfile.open(archive) as source:
            source.extractall(workspace, filter='data')
    output = workspace / 'native'
    resource = workspace / 'resource'
    llvm_cmake = subprocess.check_output(['llvm-config-18', '--cmakedir'], text=True).strip()
    subprocess.run([
        'cmake', '-S', str(workspace / 'compiler-rt-18.1.8.src'), '-B', str(output), '-G', 'Ninja',
        '-DCMAKE_BUILD_TYPE=RelWithDebInfo', '-DCMAKE_EXPORT_COMPILE_COMMANDS=ON',
        f'-DLLVM_COMMON_CMAKE_UTILS={workspace / "cmake-18.1.8.src"}',
        f'-DLLVM_CMAKE_DIR={llvm_cmake}', f'-DCMAKE_INSTALL_PREFIX={resource}',
        '-DLLVM_ENABLE_PER_TARGET_RUNTIME_DIR=OFF', '-DCOMPILER_RT_DEFAULT_TARGET_ONLY=ON',
        '-DCMAKE_C_COMPILER_TARGET=x86_64-unknown-linux-gnu',
        '-DCMAKE_CXX_COMPILER_TARGET=x86_64-unknown-linux-gnu',
        '-DCOMPILER_RT_DEBUG=ON', '-DCOMPILER_RT_SANITIZERS_TO_BUILD=tsan',
        '-DCOMPILER_RT_BUILD_BUILTINS=OFF', '-DCOMPILER_RT_BUILD_XRAY=OFF',
        '-DCOMPILER_RT_BUILD_LIBFUZZER=OFF', '-DCOMPILER_RT_BUILD_PROFILE=OFF',
        '-DCOMPILER_RT_BUILD_MEMPROF=OFF', '-DCOMPILER_RT_BUILD_ORC=OFF',
        '-DCOMPILER_RT_BUILD_GWP_ASAN=OFF', '-DCOMPILER_RT_INCLUDE_TESTS=OFF',
    ], check=True)
    commands = json.loads((output / 'compile_commands.json').read_text())
    tsan = [entry for entry in commands if entry['file'].endswith('/tsan_rtl.cpp')]
    if not tsan or any('-DSANITIZER_DEBUG=1' not in entry['command'] for entry in tsan):
        raise RuntimeError('TSan runtime must compile its existing internal assertions')
    subprocess.run(['cmake', '--build', str(output), '--target', 'install', '--parallel', '2'], check=True)
    for filename in ['libclang_rt.tsan-x86_64.a', 'libclang_rt.tsan_cxx-x86_64.a',
                     'libclang_rt.tsan-x86_64.a.syms', 'libclang_rt.tsan_cxx-x86_64.a.syms']:
        if not (resource / 'lib/linux' / filename).is_file():
            raise RuntimeError(f'Missing debug TSan runtime: {filename}')

    # An uninstrumented main has no shadow-stack entry: its first pop must fail.
    probe = workspace / 'shadow-stack-probe.cpp'
    probe.write_text('extern "C" void __tsan_func_exit();\nint main() { __tsan_func_exit(); }\n')
    obj = workspace / 'shadow-stack-probe.o'
    executable = workspace / 'shadow-stack-probe'
    subprocess.run(['clang++-18', '-c', str(probe), '-o', str(obj)], check=True)
    subprocess.run(['clang++-18', '-fsanitize=thread', f'-resource-dir={resource}',
                    str(obj), '-o', str(executable)], check=True)
    result = subprocess.run([str(executable)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, timeout=20, check=False)
    (workspace / 'shadow-stack-probe.log').write_text(result.stdout)
    if result.returncode == 0 or not all(value in result.stdout for value in
                                        ['CHECK failed:', 'tsan_rtl.h', 'shadow_stack_pos']):
        raise RuntimeError(f'Debug runtime did not catch a shadow-stack underflow:\n{result.stdout}')
    (workspace / 'source.json').write_text(json.dumps({
        'version': '18.1.8', 'archives': ARCHIVES, 'debug': True, 'resource': str(resource),
    }, indent=2) + '\n')
    print(f'PASS debug TSan catches the first invalid shadow-stack pop: {resource}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('host', type=Path)
    options = parser.parse_args()
    build(options.host.resolve())
