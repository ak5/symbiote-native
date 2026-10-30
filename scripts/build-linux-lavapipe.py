import argparse
import hashlib
import json
from pathlib import Path
import shlex
import subprocess
import tarfile
import urllib.request


def build(host):
    workspace = host / 'build/lavapipe-tsan'
    workspace.mkdir(parents=True, exist_ok=False)
    archive = workspace / 'mesa-25.2.8.tar.xz'
    with urllib.request.urlopen('https://archive.mesa3d.org/mesa-25.2.8.tar.xz', timeout=30) as response:
        content = response.read(60_000_001)
    if hashlib.sha256(content).hexdigest() != '097842f3e49d996868b38688db87b006f7d4541e93ce86d2f341d8b3e7be7c93':
        raise RuntimeError('Mesa archive does not match the official 25.2.8 checksum')
    archive.write_bytes(content)
    with tarfile.open(archive) as source_archive:
        source_archive.extractall(workspace, filter='data')
    source = workspace / 'mesa-25.2.8'
    patch = Path(__file__).resolve().parents[1] / 'core/engine/linux/host/mesa-tsan.patch'
    subprocess.run(['patch', '-N', '-t', '-p1', '-i', str(patch)], cwd=source, check=True)
    output = workspace / 'native'
    subprocess.run([
        'meson', 'setup', str(output), str(source), '--buildtype=debugoptimized',
        '--wrap-mode=nofallback', '--force-fallback-for=wayland-protocols',
        '-Db_sanitize=thread', '-Db_lundef=false',
        '-Dplatforms=wayland', '-Dvulkan-drivers=swrast', '-Dgallium-drivers=llvmpipe',
        '-Dllvm=enabled', '-Dshared-llvm=enabled', '-Dglx=disabled', '-Degl=disabled',
        '-Dgles1=disabled', '-Dgles2=disabled', '-Dopengl=false',
        '-Dgallium-va=disabled', '-Dgallium-vdpau=disabled', '-Dbuild-tests=false',
    ], check=True)
    commands = json.loads((output / 'compile_commands.json').read_text())
    checked = []
    for entry in commands:
        flags = shlex.split(entry['command'])
        if any('sanitize-blacklist' in flag or 'sanitize-ignorelist' in flag for flag in flags):
            raise RuntimeError('Driver sanitizer exclusions must not hide native diagnostics')
        if '/llvmpipe/' in entry['file'] or entry['file'].endswith('/threads_posix.c'):
            if '-fsanitize=thread' not in flags or '-DTHREAD_SANITIZER=1' not in flags:
                raise RuntimeError(f'Driver synchronization is not instrumented: {entry["file"]}')
            checked.append(entry['file'])
    if not checked or not any(name.endswith('/threads_posix.c') for name in checked):
        raise RuntimeError('Expected real lavapipe synchronization sources')
    subprocess.run(['meson', 'compile', '-C', str(output), '-j', '2',
                    'vulkan_lvp', 'lvp_devenv_icd'], check=True)
    manifests = list(output.glob('src/gallium/targets/lavapipe/lvp_devenv_icd.*.json'))
    if len(manifests) != 1:
        raise RuntimeError('Expected one native lavapipe ICD manifest')
    manifest = json.loads(manifests[0].read_text())
    library = Path(manifest['ICD']['library_path'])
    if not library.is_absolute() or not library.is_file() or not library.is_relative_to(output):
        raise RuntimeError('ICD must name the instrumented library in this build')
    (workspace / 'driver.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'PASS instrumented lavapipe: {library}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Build pinned lavapipe with TSan and no exclusions')
    parser.add_argument('host', type=Path)
    options = parser.parse_args()
    build(options.host.resolve())
