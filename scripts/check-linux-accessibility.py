#!/usr/bin/env python3
"""Exercise the production host through AT-SPI on a private D-Bus/Wayland seat."""

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('executable', type=Path)
    parser.add_argument('bundle', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--private-session', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if sys.platform != 'linux':
        parser.error('Requires the native Linux host, Sway and AT-SPI')
    if not args.private_session:
        environment = dict(os.environ)
        for name in ('DBUS_SESSION_BUS_ADDRESS', 'DBUS_SESSION_BUS_PID', 'AT_SPI_BUS_ADDRESS'):
            environment.pop(name, None)
        os.execvpe('dbus-run-session', ['dbus-run-session', '--', sys.executable,
                   str(Path(__file__).resolve()), str(args.executable.resolve()),
                   str(args.bundle.resolve()), str(args.output.resolve()), '--private-session'], environment)

    # Import only inside the newly created bus; never attach a client to the user's desktop.
    import gi
    gi.require_version('Atspi', '2.0')
    from gi.repository import Atspi, GLib

    args.output.mkdir(parents=True, exist_ok=False)
    context = GLib.MainContext.default()
    processes = []
    streams = []
    events = []
    event_log = (args.output / 'events.jsonl').open('x', encoding='utf-8')
    streams.append(event_log)
    environment = dict(os.environ)
    for name in ('WAYLAND_DISPLAY', 'SWAYSOCK', 'AT_SPI_BUS_ADDRESS'):
        environment.pop(name, None)

    def start(command, label):
        log = (args.output / f'{label}.log').open('xb')
        streams.append(log)
        process = subprocess.Popen(command, env=environment, stdin=subprocess.DEVNULL,
                                   stdout=log, stderr=subprocess.STDOUT)
        processes.append(process)
        return process

    def command(command):
        return subprocess.check_output(command, env=environment, timeout=5, text=True)

    def pump():
        while context.pending():
            context.iteration(False)

    def until(check, description, alive=(), timeout=10):
        deadline = time.monotonic() + timeout
        error = None
        while time.monotonic() < deadline:
            pump()
            for process in alive:
                assert process.poll() is None, f'{description}: native process exited {process.returncode}'
            try:
                result = check()
                if result:
                    return result
            except GLib.Error as caught:
                error = caught
            time.sleep(0.025)
        raise AssertionError(f'Timed out: {description}; last transport error: {error}')

    def walk(root):
        if root is None:
            return
        pending = [root]
        while pending:
            node = pending.pop()
            yield node
            assert node.get_child_count() <= 1024, 'Unexpectedly large fixture tree'
            for index in reversed(range(node.get_child_count())):
                child = node.get_child_at_index(index)
                if child is not None:
                    pending.append(child)

    def named(root, name):
        return next((node for node in walk(root) if node.get_name() == name), None)

    def text(node):
        interface = node.get_text_iface()
        return interface.get_text(0, -1) if interface is not None else ''

    def event_received(event, *_):
        try:
            source = event.source.get_name() if event.source else ''
        except GLib.Error:
            source = '<removed>'
        entry = {'type': event.type, 'detail1': event.detail1, 'detail2': event.detail2, 'source': source}
        events.append(entry)
        event_log.write(json.dumps(entry, ensure_ascii=False) + '\n')
        event_log.flush()

    runtime_directory = tempfile.TemporaryDirectory(prefix='symbiote-atspi-')
    try:
        directory = runtime_directory.name
        runtime = Path(directory)
        runtime.chmod(0o700)
        environment.update(XDG_RUNTIME_DIR=directory, WLR_BACKENDS='headless',
                           WLR_HEADLESS_OUTPUTS='1', WLR_RENDERER='pixman',
                           WLR_LIBINPUT_NO_DEVICES='1')
        config = runtime / 'sway.conf'
        config.write_text('xwayland disable\noutput * mode 1280x900\nseat seat0 fallback true\n')
        compositor = start(['sway', '--unsupported-gpu', '--config', str(config)], 'sway')

        def sockets_ready():
            sockets = [path for path in runtime.iterdir() if path.is_socket()]
            display = next((path for path in sockets if re.fullmatch(r'wayland-\d+', path.name)), None)
            ipc = next((path for path in sockets if path.name.startswith('sway-ipc.')), None)
            if not display or not ipc:
                return False
            environment.update(WAYLAND_DISPLAY=display.name, SWAYSOCK=str(ipc))
            return True

        until(sockets_ready, 'private compositor sockets', [compositor])
        for property_name in ('IsEnabled', 'ScreenReaderEnabled'):
            command(['gdbus', 'call', '--session', '--dest', 'org.a11y.Bus',
                     '--object-path', '/org/a11y/bus', '--method',
                     'org.freedesktop.DBus.Properties.Set', 'org.a11y.Status',
                     property_name, '<true>'])
        assert Atspi.init() == 0, 'AT-SPI initialization failed'
        Atspi.set_timeout(3000, 5000)
        listener = Atspi.EventListener.new(event_received, None)
        for event_type in ('object:state-changed', 'object:text-caret-moved',
                           'object:text-changed', 'object:property-change',
                           'object:children-changed'):
            assert listener.register(event_type), f'Cannot register {event_type}'

        for cycle in range(2):
            title = f'Native Accessibility {cycle}'
            window = start([str(args.executable.resolve()), '--fabric', str(args.bundle.resolve()),
                            '--title', title, '--no-decorations'], f'native-{cycle}')
            keys = start(['wtype', '-s', '300', '-P', 'Shift_L', '-p', 'Shift_L', '-s', '60000'],
                         f'keyboard-{cycle}')
            alive = [compositor, window, keys]
            desktop = Atspi.get_desktop(0)
            root = until(lambda: named(desktop, title), 'real AT-SPI window', alive, 20)
            editor = until(lambda: named(root, 'Native editor'), 'native editor publication', alive)
            until(lambda: text(editor) == 'é🐧z', 'Unicode editor value', alive)
            expected = {'Native group': Atspi.Role.PANEL, 'Native image': Atspi.Role.IMAGE,
                        'Native scroll': Atspi.Role.PANEL, 'Native editor': Atspi.Role.ENTRY,
                        'Native action': Atspi.Role.PUSH_BUTTON}
            for name, role in expected.items():
                node = until(lambda: named(root, name), name, alive)
                assert node.get_role() == role, (name, node.get_role_name())
                bounds = node.get_component_iface().get_extents(Atspi.CoordType.WINDOW)
                assert bounds.width > 0 and bounds.height > 0, (name, bounds)
            nodes = list(walk(root))
            assert any(text(node) == 'café 雪 🐧' for node in nodes), 'Static Unicode text missing'
            visible = '\n'.join(node.get_name() + '\n' + text(node) for node in nodes)
            for hidden in ('private-fixture-only', 'Hidden private subtree', 'Display none subtree'):
                assert hidden not in visible, f'Private/hidden text exposed: {hidden}'
            protected = named(root, 'Protected editor')
            assert protected.get_role() == Atspi.Role.PASSWORD_TEXT
            assert text(protected) and 'private-fixture-only' not in text(protected)
            assert f"a{'́' * 128}" in visible, 'Long grapheme readable fallback lost text'
            disabled = named(root, 'Disabled action')
            assert not disabled.get_state_set().contains(Atspi.StateType.ENABLED)
            readonly = named(root, 'Readonly editor')
            assert not readonly.get_editable_text_iface().set_text_contents('overwrite')
            assert text(readonly) == 'readonly café'
            until(lambda: 'AT-SPI native image loaded' in (args.output / f'native-{cycle}.log').read_text(errors='replace'),
                  'actual native image decode and load event', alive)
            print(f'PASS native AT-SPI six components, Unicode, geometry, hidden and protected text cycle={cycle}', flush=True)

            events.clear()
            assert editor.get_component_iface().grab_focus()
            until(lambda: editor.get_state_set().contains(Atspi.StateType.FOCUSED), 'actual native focus', alive)
            until(lambda: any(event['type'].startswith('object:state-changed:focused') and
                              event['source'] == 'Native editor' and event['detail1'] == 1 for event in events),
                  'focus event', alive)
            command(['wtype', '-P', 'Left', '-p', 'Left'])
            until(lambda: editor.get_text_iface().get_caret_offset() == 2, 'native caret movement', alive)
            until(lambda: any(event['type'].startswith('object:text-caret-moved') and
                              event['source'] == 'Native editor' for event in events), 'caret event', alive)
            assert editor.get_editable_text_iface().set_text_contents('é🐧z!')
            until(lambda: text(editor) == 'é🐧z!', 'native editable-text replacement', alive)
            assert editor.get_text_iface().add_selection(1, 2)
            def selected_emoji():
                interface = editor.get_text_iface()
                if interface.get_n_selections() != 1:
                    return False
                selection = interface.get_selection(0)
                return selection.start_offset == 1 and selection.end_offset == 2
            until(selected_emoji, 'native Unicode selection acknowledgement', alive)
            command(['wtype', 'X'])
            until(lambda: text(editor) == 'éXz!', 'native Unicode selection replacement', alive)
            until(lambda: any(event['type'].startswith('object:text-changed') and
                              event['source'] == 'Native editor' for event in events), 'text edit event', alive)
            empty = named(root, 'Empty editor')
            assert empty.get_editable_text_iface().set_text_contents('empty 雪')
            until(lambda: text(empty) == 'empty 雪', 'empty editable field', alive)
            print(f'PASS native AT-SPI focus, caret and real editing cycle={cycle}', flush=True)

            events.clear()
            action = named(root, 'Native action').get_action_iface()
            assert action is not None and action.get_n_actions() > 0
            assert action.do_action(0)
            until(lambda: named(root, 'Native count 1'), 'native Pressable action', alive)
            until(lambda: any(event['type'].startswith(('object:property-change', 'object:text-changed'))
                              for event in events), 'native action change notification', alive)
            log = (args.output / f'native-{cycle}.log')
            until(lambda: 'AT-SPI native action' in log.read_text(errors='replace') and
                              'AT-SPI native edit: éXz!' in log.read_text(errors='replace'),
                  'real framework event handlers', alive)
            print(f'PASS native AT-SPI activation and notifications cycle={cycle}', flush=True)

            command(['swaymsg', f'[title="{title}"]', 'kill'])
            assert window.wait(timeout=10) == 0, 'Native shutdown failed'
            until(lambda: not named(desktop, title), 'AT-SPI session removal', [compositor], 10)
            keys.terminate()
            keys.wait(timeout=5)
            print(f'PASS native AT-SPI graceful removal cycle={cycle}', flush=True)
        listener.deregister('object:state-changed')
        Atspi.exit()
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)
        for stream in streams:
            stream.close()
        runtime_directory.cleanup()


if __name__ == '__main__':
    main()
