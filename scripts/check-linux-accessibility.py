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
    parser.add_argument('--scenario', choices=('accessibility', 'modal'), default='accessibility')
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
                   str(args.bundle.resolve()), str(args.output.resolve()), '--private-session',
                   '--scenario', args.scenario], environment)

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
        # GI's Accessible.get_text() is the deprecated interface getter, not Text.get_text().
        return Atspi.Text.get_text(interface, 0, -1) if interface is not None else ''

    def event_received(event, *_):
        try:
            source = event.source.get_name() if event.source else ''
        except GLib.Error:
            source = '<removed>'
        entry = {'type': event.type, 'detail1': event.detail1, 'detail2': event.detail2, 'source': source}
        events.append(entry)
        event_log.write(json.dumps(entry, ensure_ascii=False) + '\n')
        event_log.flush()

    def exercise_modal(root, desktop, window, alive, cycle):
        from PIL import Image
        import socket

        def control(name):
            return until(lambda: named(root, name), name, alive)

        def activate(node):
            action = node.get_action_iface()
            assert action is not None and action.do_action(0), node.get_name()

        def focused(node):
            return node.get_state_set().contains(Atspi.StateType.FOCUSED)

        def bounds(node):
            return node.get_component_iface().get_extents(Atspi.CoordType.WINDOW)

        def screenshot(mode):
            log = (args.output / f'native-{cycle}.log').read_text(errors='replace')
            match = re.search(r'\[rnl-automation\] listening on ([^\n]+)', log)
            assert match, 'Native automation socket was not published'
            endpoint = Path(match.group(1)).resolve()
            assert endpoint.parent == Path(environment['XDG_RUNTIME_DIR']).resolve()
            path = (args.output / f'modal-{cycle}-{mode}.png').resolve()
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as channel:
                channel.settimeout(5)
                channel.connect(str(endpoint))
                channel.sendall((json.dumps({'command': 'TakeScreenshot', 'path': str(path)}) + '\n').encode())
                with channel.makefile('r', encoding='utf-8') as response:
                    result = json.loads(response.readline(65536))
                assert result.get('ok') is True, result
            with Image.open(path) as image:
                window_bounds = bounds(root)
                assert image.size == (window_bounds.width, window_bounds.height), (image.size, window_bounds)
                actual = image.convert('RGB').getpixel((8, image.height - 8))
                expected = (0x14, 0x25, 0x36) if mode == 'slide' else (255, 255, 255)
                assert max(abs(a - b) for a, b in zip(actual, expected)) <= 2, (mode, actual, expected)

        title = root.get_name()
        command(['swaymsg', f'[title="{title}"]', 'floating', 'enable'])
        background = control('Modal background')
        assert background.get_editable_text_iface().set_text_contents('kept雪')
        until(lambda: text(background) == 'kept雪', 'background draft before presentation', alive)
        assert background.get_component_iface().grab_focus()
        assert Atspi.Text.set_caret_offset(background, 2)
        until(lambda: Atspi.Text.get_caret_offset(background) == 2, 'background caret before presentation', alive)

        for index, mode in enumerate(('none', 'fade', 'slide'), 1):
            opener = control(f'Open {mode} modal')
            stale_action = control('Background action').get_action_iface()
            activate(opener)
            dialog = control('Native modal')
            assert dialog.get_role() == Atspi.Role.DIALOG, dialog.get_role_name()
            assert dialog.get_state_set().contains(Atspi.StateType.MODAL), 'Native dialog is not modal'
            assert named(root, 'Modal background') is None, 'Background leaked into active modal accessibility'
            editor = control('Modal editor')
            until(lambda: focused(editor), 'initial modal focus', alive)
            assert editor.get_editable_text_iface().set_text_contents('modal雪')
            until(lambda: text(editor) == 'modal雪', 'native modal editable text', alive)
            command(['wtype', 'Q'])
            until(lambda: text(editor) == 'modal雪Q', 'native keyboard reaches modal', alive)
            assert Atspi.Text.set_caret_offset(editor, 2)
            until(lambda: Atspi.Text.get_caret_offset(editor) == 2, 'modal caret before nesting', alive)
            try:
                stale_action.do_action(0)
                background.get_editable_text_iface().set_text_contents('blocked overwrite')
            except GLib.Error:
                pass
            before_resize = bounds(root)
            resized = json.loads(command(['swaymsg', f'[title="{title}"]', 'resize', 'set',
                                          str(900 + index * 20), str(600 + index * 10)]))
            assert all(reply.get('success') for reply in resized), resized
            until(lambda: abs(bounds(root).width - before_resize.width) >= 10 or
                  abs(bounds(root).height - before_resize.height) >= 5, 'actual compositor resize', alive)
            until(lambda: (bounds(dialog).width, bounds(dialog).height) ==
                  (bounds(root).width, bounds(root).height), 'modal follows real window resize', alive)
            assert text(editor) == 'modal雪Q', 'Resize discarded modal editor state'
            until(lambda: text(control('Modal shown count')).strip() == str(index),
                  'native entrance animation completion', alive)
            assert bounds(dialog).x == 0 and bounds(dialog).y == 0, 'Modal inherited parent positioning'
            screenshot(mode)
            nested_opener = control('Open nested modal')
            activate(nested_opener)
            nested_dialog = control('Native nested modal')
            assert nested_dialog.get_role() == Atspi.Role.DIALOG
            assert named(root, 'Native modal') is None, 'Outer dialog leaked through nested modal'
            nested_editor = control('Nested editor')
            until(lambda: focused(nested_editor), 'nested modal focus', alive)
            command(['wtype', 'N'])
            until(lambda: text(nested_editor) == 'N', 'nested native keyboard input', alive)
            command(['wtype', '-P', 'Escape', '-p', 'Escape'])
            until(lambda: named(root, 'Native nested modal') is None and named(root, 'Native modal'),
                  'nested dismissal returns to parent dialog', alive)
            until(lambda: focused(control('Open nested modal')), 'nested invoker focus restoration', alive)
            editor = control('Modal editor')
            assert editor.get_component_iface().grab_focus()
            until(lambda: focused(editor) and text(editor) == 'modal雪Q' and
                  Atspi.Text.get_caret_offset(editor) == 2, 'parent draft and caret after nested dismissal', alive)
            command(['wtype', '-P', 'Escape', '-p', 'Escape'])
            until(lambda: named(root, 'Native modal') is None and named(root, 'Modal background'),
                  'native dismissal returns background accessibility', alive)
            until(lambda: focused(control(f'Open {mode} modal')), 'outer invoker focus restoration', alive)
            background = control('Modal background')
            assert background.get_component_iface().grab_focus()
            until(lambda: focused(background) and text(background) == 'kept雪' and
                  Atspi.Text.get_caret_offset(background) == 2, 'background draft and caret preserved', alive)
            until(lambda: text(control('Background count')).strip() == '0', 'background action stayed blocked', alive)
            expected = f'shown={index} dismissed={index} requested={index} nested={index}'
            until(lambda: text(control('Modal lifecycle')).strip() == expected,
                  'real adapter receives exactly one show/dismiss/close event', alive)
            print(f'PASS native modal {mode}: pixels, real resize, nested focus, editor state and controlled dismissal cycle={cycle}', flush=True)

        activate(control('Open fade modal'))
        old_root = root
        old_editor = control('Modal editor')
        activate(control('Reload modal runtime'))

        def replacement_root():
            candidate = named(desktop, title)
            return candidate if candidate is not None and candidate != old_root else None

        root = until(replacement_root, 'modal runtime reload in the same native window', alive, 20)
        background = control('Modal background')
        until(lambda: text(background) == 'a雪b', 'fresh modal runtime library', alive)
        try:
            old_editor.get_editable_text_iface().set_text_contents('late modal data')
        except GLib.Error:
            pass
        assert background.get_component_iface().grab_focus()
        command(['wtype', 'R'])
        until(lambda: text(background) == 'a雪bR' and named(root, 'Native modal') is None,
              'old modal handles cannot mutate reloaded library', alive)
        print(f'PASS native modal in-process reload and stale editor handles cycle={cycle}', flush=True)

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
            window_command = [str(args.executable.resolve()), '--fabric', str(args.bundle.resolve()),
                              '--title', title, '--no-decorations']
            if args.scenario == 'modal':
                window_command.append('--automation')
            window = start(window_command, f'native-{cycle}')
            keys = start(['wtype', '-s', '300', '-P', 'Shift_L', '-p', 'Shift_L', '-s', '60000'],
                         f'keyboard-{cycle}')
            alive = [compositor, window, keys]
            desktop = Atspi.get_desktop(0)
            root = until(lambda: named(desktop, title), 'real AT-SPI window', alive, 20)
            if environment.get('VK_DRIVER_FILES'):
                driver = json.loads(Path(environment['VK_DRIVER_FILES']).read_text())
                library = Path(driver['ICD']['library_path'])
                assert library.is_absolute() and library.is_file(), 'Expected a real native Vulkan driver'
                assert str(library) in Path(f'/proc/{window.pid}/maps').read_text(), 'Expected driver was not loaded'
                print(f'PASS native Vulkan driver loaded: {library}', flush=True)
            if args.scenario == 'modal':
                exercise_modal(root, desktop, window, alive, cycle)
            else:
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
                until(lambda: Atspi.Text.get_caret_offset(editor) == 2, 'native caret movement', alive)
                until(lambda: any(event['type'].startswith('object:text-caret-moved') and
                                  event['source'] == 'Native editor' for event in events), 'caret event', alive)
                assert editor.get_editable_text_iface().set_text_contents('é🐧z!')
                until(lambda: text(editor) == 'é🐧z!', 'native editable-text replacement', alive)
                assert Atspi.Text.add_selection(editor, 1, 2)
                def selected_emoji():
                    interface = editor.get_text_iface()
                    if Atspi.Text.get_n_selections(interface) != 1:
                        return False
                    selection = Atspi.Text.get_selection(interface, 0)
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

                custom = until(lambda: named(root, 'Native custom actions'), 'custom action control', alive)
                custom_actions = custom.get_action_iface()
                assert custom_actions is not None
                assert Atspi.Action.get_n_actions(custom_actions) == 2
                assert [Atspi.Action.get_action_name(custom_actions, index) for index in range(2)] == ['Archive item', 'Copy identifier']
                assert not Atspi.Action.do_action(custom_actions, -1)
                assert not Atspi.Action.do_action(custom_actions, 2)
                assert Atspi.Action.do_action(custom_actions, 0)
                until(lambda: named(root, 'Native custom archive'), 'real declared archive handler', alive)
                until(lambda: Atspi.Action.get_action_name(custom_actions, 0) == 'Copy identifier',
                      'updated custom action order', alive)
                assert Atspi.Action.do_action(custom_actions, 0)
                until(lambda: named(root, 'Native custom copyId'), 'reordered action preserves its identity', alive)
                until(lambda: 'AT-SPI native custom action: archive' in log.read_text(errors='replace') and
                                  'AT-SPI native custom action: copyId' in log.read_text(errors='replace'),
                      'real native custom event payloads', alive)
                print(f'PASS native AT-SPI custom action labels, identities and reordered handlers cycle={cycle}', flush=True)

                old_root = root
                reloads_before = log.read_text(errors='replace').count('[rnl-reload] reloaded')
                reload_action = named(root, 'Reload native session').get_action_iface()
                assert reload_action.do_action(0)
                accepted, rejected = 0, 0
                # Spread real old-handle requests across native frames while the owner reloads.
                for request in range(32):
                    pump()
                    try:
                        if Atspi.EditableText.set_text_contents(editor, f'old-session-{request}'):
                            accepted += 1
                        else:
                            rejected += 1
                    except GLib.Error:
                        rejected += 1
                        break
                    time.sleep(0.005)
                until(lambda: log.read_text(errors='replace').count('[rnl-reload] reloaded') == reloads_before + 1,
                      'in-process native session reload', alive)

                def replaced_root():
                    candidate = named(desktop, title)
                    return candidate if candidate is not None and candidate != old_root else None

                root = until(replaced_root, 'new AT-SPI adapter in the same process', alive)
                replacement = until(lambda: named(root, 'Native editor'), 'new native editor', alive)
                until(lambda: text(replacement) == 'é🐧z' and named(root, 'Native count 0'),
                      'fresh native session state', alive)
                try:
                    Atspi.EditableText.set_text_contents(editor, 'late-after-reload')
                except GLib.Error:
                    pass  # A removed AT-SPI object is expected to reject the old handle.
                assert replacement.get_component_iface().grab_focus()
                until(lambda: replacement.get_state_set().contains(Atspi.StateType.FOCUSED),
                      'replacement editor native focus', alive)
                command(['wtype', 'Q'])
                until(lambda: text(replacement) == 'é🐧zQ', 'old handles cannot edit the replacement session', alive)
                print(f'PASS native AT-SPI in-process reload and stale handles cycle={cycle} accepted={accepted} rejected={rejected}', flush=True)

            command(['swaymsg', f'[title="{title}"]', 'kill'])
            assert window.wait(timeout=10) == 0, 'Native shutdown failed'
            until(lambda: not named(desktop, title), 'AT-SPI session removal', [compositor], 10)
            keys.terminate()
            keys.wait(timeout=5)
            label = 'AT-SPI' if args.scenario == 'accessibility' else 'modal'
            print(f'PASS native {label} graceful removal cycle={cycle}', flush=True)
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
