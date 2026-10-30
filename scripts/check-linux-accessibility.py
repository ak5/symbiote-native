#!/usr/bin/env python3
"""Exercise the production host through AT-SPI on a private D-Bus/Wayland seat."""

import argparse
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('executable', type=Path)
    parser.add_argument('bundle', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--scenario', choices=('accessibility', 'modal', 'refresh'), default='accessibility')
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

    def start(command, label, stdin=subprocess.DEVNULL):
        log = (args.output / f'{label}.log').open('xb')
        streams.append(log)
        process = subprocess.Popen(command, env=environment, stdin=stdin,
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

    def capture_screenshot(cycle, label):
        log = (args.output / f'native-{cycle}.log').read_text(errors='replace')
        match = re.search(r'\[rnl-automation\] listening on ([^\n]+)', log)
        assert match, 'Native automation socket was not published'
        endpoint = Path(match.group(1)).resolve()
        assert endpoint.parent == Path(environment['XDG_RUNTIME_DIR']).resolve()
        path = (args.output / label).resolve()
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as channel:
            channel.settimeout(5)
            channel.connect(str(endpoint))
            channel.sendall((json.dumps({'command': 'TakeScreenshot', 'path': str(path)}) + '\n').encode())
            with channel.makefile('r', encoding='utf-8') as response:
                result = json.loads(response.readline(65536))
            assert result.get('ok') is True, result
        return path

    def exercise_modal(root, desktop, window, alive, cycle):
        from PIL import Image

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
            path = capture_screenshot(cycle, f'modal-{cycle}-{mode}.png')
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
        until(lambda: named(root, 'Background draft: kept雪'), 'app acknowledged background draft', alive)
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
            until(lambda: named(root, 'Modal draft: modal雪Q'), 'app acknowledged modal draft', alive)
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
            assert text(editor) == 'modal雪Q', f'Resize discarded modal editor state: {text(editor)!r}'
            until(lambda: named(root, f'Modal shown count {index}'),
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
            until(lambda: named(root, 'Background count 0'), 'background action stayed blocked', alive)
            expected = f'shown={index} dismissed={index} requested={index} nested={index}'
            until(lambda: named(root, f'Modal lifecycle {expected}'),
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

    def exercise_refresh(root, desktop, window, alive, cycle):
        from PIL import Image

        def control(name):
            return until(lambda: named(root, name), name, alive)

        def activate(node):
            action = node.get_action_iface()
            assert action is not None and action.do_action(0), node.get_name()

        def bounds(node):
            return node.get_component_iface().get_extents(Atspi.CoordType.WINDOW)

        def busy(node):
            return node.get_state_set().contains(Atspi.StateType.BUSY)

        def status(mode, accepted, rejected, refreshing=False, mounted=True):
            expected = (f'Refresh state mode={mode} accepted={accepted} rejected={rejected} '
                        f'refreshing={str(refreshing).lower()} mounted={str(mounted).lower()}')
            until(lambda: named(root, expected), expected, alive)

        def draft_preserved():
            field = control('Refresh draft')
            assert text(field) == 'kept雪', 'Refresh discarded the draft'
            assert Atspi.Text.get_caret_offset(field) == 2, 'Refresh discarded the draft caret'
            assert named(root, 'Refresh draft value: kept雪'), 'Framework draft differs from native text'

        title = root.get_name()
        replies = json.loads(command(['swaymsg', f'[title="{title}"]', 'fullscreen', 'enable']))
        assert all(reply.get('success') for reply in replies), replies
        until(lambda: bounds(root).width >= 1000 and bounds(root).height >= 700,
              'private fullscreen client dimensions', alive)
        status('accept', 0, 0)
        field = control('Refresh draft')
        assert field.get_editable_text_iface().set_text_contents('kept雪')
        until(lambda: named(root, 'Refresh draft value: kept雪') and text(field) == 'kept雪',
              'framework acknowledged refresh draft', alive)
        assert field.get_component_iface().grab_focus()
        assert Atspi.Text.set_caret_offset(field, 2)
        until(lambda: Atspi.Text.get_caret_offset(field) == 2, 'initial refresh draft caret', alive)
        refresh = control('Refresh library')
        assert refresh.get_role() == Atspi.Role.PUSH_BUTTON, refresh.get_role_name()
        assert not busy(refresh), 'Idle refresh control is busy'
        scroll = control('Refresh scroll')
        injector_path = args.executable.resolve().with_name('rnl_inject')
        assert injector_path.is_file(), 'The actual Wayland input driver is required'
        injector = start([str(injector_path)], f'refresh-input-{cycle}', stdin=subprocess.PIPE)
        alive.append(injector)

        def pan(delta):
            rect = bounds(scroll)
            x, y = rect.x + rect.width // 2, rect.y + rect.height // 2
            script = f'move {x} {y}\nsleep 100\npan 0 {delta}\nsleep 100\npan_stop\n'
            assert injector.poll() is None, 'Native Wayland injector exited'
            injector.stdin.write(script.encode())
            injector.stdin.flush()

        pan(-160)
        status('accept', 1, 0, True)
        until(lambda: busy(control('Refresh library')), 'native accepted refresh busy state', alive)
        path = capture_screenshot(cycle, f'refresh-{cycle}.png')
        with Image.open(path) as image:
            client = bounds(root)
            assert image.size == (client.width, client.height), (image.size, client)
            rect = bounds(control('Refresh library'))
            pixels = image.convert('RGB').crop((rect.x, rect.y, rect.x + rect.width, rect.y + rect.height))
            gold = sum(max(abs(actual - expected) for actual, expected in zip(pixel, (255, 221, 102))) < 20
                       for pixel in pixels.getdata())
            assert gold >= 4, f'Native refresh indicator was not painted: {gold} matching pixels'
        draft_preserved()
        print(f'PASS native refresh real Wayland pull, framework callback, busy state and indicator pixels cycle={cycle}', flush=True)

        pending = refresh.get_action_iface()
        try:
            pending.do_action(0)
        except GLib.Error:
            pass
        status('accept', 1, 0, True)
        activate(control('Finish refresh'))
        status('accept', 1, 0)
        until(lambda: not busy(control('Refresh library')), 'controlled native refresh stop', alive)
        assert control('Refresh library').get_component_iface().grab_focus()
        command(['wtype', '-P', 'Return', '-p', 'Return'])
        status('accept', 2, 0, True)
        activate(control('Finish refresh'))
        status('accept', 2, 0)
        until(lambda: not busy(control('Refresh library')), 'keyboard refresh stopped', alive)
        activate(control('Toggle refresh mode'))
        status('reject', 2, 0)
        pan(-160)
        status('reject', 2, 1)
        until(lambda: not busy(control('Refresh library')), 'rejected native refresh snapped back', alive)
        draft_preserved()
        print(f'PASS native refresh duplicate guard, keyboard activation and rejected controlled handshake cycle={cycle}', flush=True)

        activate(control('Start refresh'))
        status('reject', 2, 1, True)
        until(lambda: busy(control('Refresh library')), 'programmatic native refresh', alive)
        previous = control('Refresh library').get_action_iface()
        activate(control('Toggle refresh control'))
        status('reject', 2, 1, True, False)
        until(lambda: named(root, 'Refresh library') is None, 'native refresh control removed', alive)
        try:
            previous.do_action(0)
        except GLib.Error:
            pass
        activate(control('Finish refresh'))
        status('reject', 2, 1, False, False)
        activate(control('Toggle refresh control'))
        status('reject', 2, 1)
        until(lambda: not busy(control('Refresh library')), 'replacement native control is idle', alive)
        activate(control('Toggle refresh mode'))
        status('accept', 2, 1)
        activate(control('Refresh library'))
        status('accept', 3, 1, True)
        activate(control('Finish refresh'))
        status('accept', 3, 1)
        draft_preserved()
        print(f'PASS native refresh programmatic start, removal, stale actions and fresh control cycle={cycle}', flush=True)

        background_action = control('Refresh library').get_action_iface()
        activate(control('Open refresh modal'))
        control('Refresh blocking modal')
        assert named(root, 'Refresh library') is None, 'Background refresh leaked through modal scope'
        try:
            background_action.do_action(0)
        except GLib.Error:
            pass
        command(['wtype', '-P', 'Escape', '-p', 'Escape'])
        until(lambda: named(root, 'Refresh blocking modal') is None and named(root, 'Refresh library'),
              'native refresh modal dismissal', alive)
        status('accept', 3, 1)
        draft_preserved()
        print(f'PASS native refresh modal isolation and draft preservation cycle={cycle}', flush=True)

        old_root = root
        old_control = control('Refresh library').get_action_iface()
        activate(control('Reload refresh runtime'))

        def replacement_root():
            candidate = named(desktop, title)
            return candidate if candidate is not None and candidate != old_root else None

        root = until(replacement_root, 'new refresh runtime in the same native window', alive, 20)
        status('accept', 0, 0)
        fresh = control('Refresh draft')
        until(lambda: text(fresh) == 'a雪b', 'fresh refresh runtime draft', alive)
        try:
            old_control.do_action(0)
        except GLib.Error:
            pass
        assert fresh.get_component_iface().grab_focus()
        command(['wtype', 'R'])
        until(lambda: text(fresh) == 'a雪bR' and named(root, 'Refresh draft value: a雪bR'),
              'fresh framework draft remains independent of old refresh handles', alive)
        status('accept', 0, 0)
        assert not busy(control('Refresh library')), 'Old runtime action started a new library refresh'
        print(f'PASS native refresh in-process reload and stale handles cycle={cycle}', flush=True)
        injector.stdin.close()
        assert injector.wait(timeout=5) == 0, 'Native Wayland input driver shutdown failed'
        alive.remove(injector)


    def exercise_selection_and_value(root, alive, cycle):
        tabs = until(lambda: named(root, 'Native tabs'), 'native tab list', alive)
        assert tabs.get_role() == Atspi.Role.PAGE_TAB_LIST, tabs.get_role_name()
        selection = tabs.get_selection_iface()
        assert selection is not None, 'Native tab list has no real AT-SPI Selection interface'
        alpha = until(lambda: named(root, 'Native tab alpha'), 'first native tab', alive)
        beta = until(lambda: named(root, 'Native tab beta'), 'second native tab', alive)
        assert alpha.get_role() == Atspi.Role.PAGE_TAB and beta.get_role() == Atspi.Role.PAGE_TAB
        assert selection.get_n_selected_children() == 1
        assert selection.get_selected_child(0) == alpha
        assert selection.is_child_selected(0) and not selection.is_child_selected(1)
        assert not selection.select_child(2), 'Disabled tab accepted native selection'
        assert beta.get_state_set().contains(Atspi.StateType.SELECTABLE), 'Unselected tab cannot be selected'
        assert selection.select_child(1), 'AT-SPI rejected selecting the initially unselected tab'
        until(lambda: selection.get_selected_child(0) == beta and named(root, 'Native selected tab beta'),
              'native selection reached the framework and returned as selected state', alive)
        assert selection.get_n_selected_children() == 1
        assert not selection.is_child_selected(0) and selection.is_child_selected(1)
        assert alpha.get_state_set().contains(Atspi.StateType.SELECTABLE), 'Deselected tab lost selectability'
        assert selection.select_child(0), 'AT-SPI rejected selecting the deselected tab'
        until(lambda: selection.get_selected_child(0) == alpha and named(root, 'Native selected tab alpha'),
              'native selection can return to the original tab', alive)
        assert selection.get_n_selected_children() == 1
        print(f'PASS native AT-SPI Selection: unselected tab, controlled state and reselection cycle={cycle}', flush=True)

        radio = until(lambda: named(root, 'Native radio group'), 'native radio group', alive)
        radio_selection = radio.get_selection_iface()
        assert radio_selection is not None, 'Radio group has no native Selection interface'
        first = until(lambda: named(root, 'Native radio one'), 'first native radio', alive)
        second = until(lambda: named(root, 'Native radio two'), 'second native radio', alive)
        assert radio_selection.get_n_selected_children() == 1
        assert radio_selection.get_selected_child(0) == first, 'Checked radio is not selected'
        assert radio_selection.select_child(1), 'Unchecked radio could not be selected'
        until(lambda: radio_selection.get_selected_child(0) == second and named(root, 'Native selected radio two'),
              'native radio selection updates controlled checked props', alive)
        assert radio_selection.get_n_selected_children() == 1
        assert not radio_selection.is_child_selected(0) and radio_selection.is_child_selected(1)
        print(f'PASS native AT-SPI radio Selection from checked props cycle={cycle}', flush=True)

        progress = until(lambda: named(root, 'Native progress'), 'native numeric progress', alive)
        assert progress.get_role() == Atspi.Role.PROGRESS_BAR, progress.get_role_name()
        value = progress.get_value_iface()
        assert value is not None, 'Numeric accessibility props did not expose AT-SPI Value'
        assert value.get_minimum_value() == 0 and value.get_maximum_value() == 100
        assert value.get_current_value() == 40
        updates_before = len(events)
        advance = until(lambda: named(root, 'Advance native progress'), 'native progress action', alive)
        assert advance.get_action_iface().do_action(0)
        until(lambda: value.get_current_value() == 50, 'numeric native value after framework update', alive)
        until(lambda: any(event['source'] == 'Native progress' and
                          event['type'].startswith('object:property-change:accessible-value')
                          for event in events[updates_before:]), 'native numeric value change event', alive)
        assert value.get_minimum_value() == 0 and value.get_maximum_value() == 100
        print(f'PASS native AT-SPI Value: numeric range, controlled update and value event cycle={cycle}', flush=True)
        return selection

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
            if args.scenario in ('modal', 'refresh'):
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
            elif args.scenario == 'refresh':
                exercise_refresh(root, desktop, window, alive, cycle)
            else:
                previous_selection = exercise_selection_and_value(root, alive, cycle)
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
                try:
                    previous_selection.select_child(1)
                except GLib.Error:
                    pass
                command(['wtype', 'R'])
                until(lambda: text(replacement) == 'é🐧zQR', 'native input after stale selection request', alive)
                fresh_tabs = until(lambda: named(root, 'Native tabs'), 'fresh native tab list', alive)
                fresh_selection = fresh_tabs.get_selection_iface()
                assert fresh_selection.is_child_selected(0) and not fresh_selection.is_child_selected(1)
                assert named(root, 'Native selected tab alpha'), 'Old selection mutated the reloaded library'
                print(f'PASS native AT-SPI stale selection handles after reload cycle={cycle}', flush=True)


            command(['swaymsg', f'[title="{title}"]', 'kill'])
            assert window.wait(timeout=10) == 0, 'Native shutdown failed'
            until(lambda: not named(desktop, title), 'AT-SPI session removal', [compositor], 10)
            keys.terminate()
            keys.wait(timeout=5)
            label = 'AT-SPI' if args.scenario == 'accessibility' else args.scenario
            print(f'PASS native {label} graceful removal cycle={cycle}', flush=True)
        listener.deregister('object:state-changed')
        Atspi.exit()
    finally:
        if args.scenario in ('modal', 'refresh') and 'root' in locals() and 'window' in locals() and window.poll() is None:
            try:
                diagnostic = []
                for node in walk(root):
                    try:
                        component = node.get_component_iface()
                        rect = component.get_extents(Atspi.CoordType.WINDOW) if component else None
                        diagnostic.append({'name': node.get_name(), 'role': node.get_role_name(),
                                           'text': text(node),
                                           'bounds': [rect.x, rect.y, rect.width, rect.height] if rect else None})
                    except GLib.Error:
                        continue
                (args.output / f'failure-tree-{cycle}.json').write_text(
                    json.dumps(diagnostic, ensure_ascii=False, indent=2) + '\n')
            except Exception as error:
                print(f'Could not collect private native diagnostics: {error}', file=sys.stderr)
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)
        for process in processes:
            if process.stdin is not None:
                try:
                    process.stdin.close()
                except BrokenPipeError:
                    pass
        for stream in streams:
            stream.close()
        runtime_directory.cleanup()


if __name__ == '__main__':
    main()
