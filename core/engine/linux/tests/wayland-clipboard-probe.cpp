#include "WaylandClipboard.h"
#include "xdg-shell-client-protocol.h"

#include <algorithm>
#include <atomic>
#include <cerrno>
#include <chrono>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>
#include <memory>
#include <poll.h>
#include <stdexcept>
#include <string>
#include <syncstream>
#include <sys/mman.h>
#include <unistd.h>
#include <vector>
#include <wayland-client.h>
#include <xkbcommon/xkbcommon-keysyms.h>
#include <xkbcommon/xkbcommon.h>

namespace {

void report(const std::string& text) { std::osyncstream(std::cout) << text << std::endl; }

std::string readFile(const char* name) {
    std::ifstream input(name, std::ios::binary);
    if (!input) {
        throw std::runtime_error("Cannot read clipboard fixture");
    }
    return {std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
}

struct Buffer {
    int descriptor{-1};
    void* pixels{MAP_FAILED};
    size_t bytes{0};
    wl_buffer* proxy{nullptr};

    ~Buffer() {
        if (proxy) {
            wl_buffer_destroy(proxy);
        }
        if (pixels != MAP_FAILED) {
            munmap(pixels, bytes);
        }
        if (descriptor >= 0) {
            close(descriptor);
        }
    }
};

struct Probe {
    wl_display* display{nullptr};
    wl_registry* registry{nullptr};
    wl_compositor* compositor{nullptr};
    wl_shm* sharedMemory{nullptr};
    wl_seat* seat{nullptr};
    wl_keyboard* keyboard{nullptr};
    wl_data_device_manager* manager{nullptr};
    xdg_wm_base* shell{nullptr};
    wl_surface* surface{nullptr};
    xdg_surface* shellSurface{nullptr};
    xdg_toplevel* top{nullptr};
    xkb_context* keyContext{xkb_context_new(XKB_CONTEXT_NO_FLAGS)};
    xkb_keymap* keymap{nullptr};
    xkb_state* keys{nullptr};
    std::shared_ptr<react_native_linux::WaylandClipboard> clipboard;
    std::vector<std::unique_ptr<Buffer>> buffers;
    std::string outgoing;
    std::string expected;
    std::string mode;
    int width{128};
    int height{128};
    int drawnWidth{0};
    int drawnHeight{0};
    bool writeRequested{false};
    bool readRequested{false};
    std::atomic<bool> done{false};
    std::atomic<bool> failed{false};
    std::atomic<bool> readCompleted{false};
    std::atomic<bool> readRejected{false};

    ~Probe() {
        if (clipboard) {
            clipboard->stop();
            clipboard.reset();
        }
        if (keyboard) {
            wl_keyboard_release(keyboard);
        }
        if (top) {
            xdg_toplevel_destroy(top);
        }
        if (shellSurface) {
            xdg_surface_destroy(shellSurface);
        }
        if (surface) {
            wl_surface_destroy(surface);
        }
        buffers.clear();
        if (shell) {
            xdg_wm_base_destroy(shell);
        }
        if (manager) {
            wl_data_device_manager_destroy(manager);
        }
        if (seat) {
            wl_seat_release(seat);
        }
        if (sharedMemory) {
            wl_shm_destroy(sharedMemory);
        }
        if (compositor) {
            wl_compositor_destroy(compositor);
        }
        if (registry) {
            wl_registry_destroy(registry);
        }
        if (display) {
            wl_display_disconnect(display);
        }
        if (keys) {
            xkb_state_unref(keys);
        }
        if (keymap) {
            xkb_keymap_unref(keymap);
        }
        if (keyContext) {
            xkb_context_unref(keyContext);
        }
    }

    void finish(bool success, const char* message) {
        if (!success) {
            failed = true;
        }
        report(std::string(success ? "PASS: " : "FAIL: ") + message);
        done = true;
    }

    void onKey(uint32_t serial, uint32_t key, uint32_t state) {
        if (state != WL_KEYBOARD_KEY_STATE_PRESSED || !keys) {
            return;
        }
        clipboard->setSelectionSerial(serial);
        const auto symbol = xkb_state_key_get_one_sym(keys, key + 8);
        if (symbol == XKB_KEY_F1 && !writeRequested) {
            writeRequested = true;
            clipboard->writeText(outgoing, [this](bool accepted) {
                if (mode == "reject-write") {
                    finish(!accepted, "invalid native write rejected");
                } else if (!accepted) {
                    finish(false, "native write was not acknowledged");
                } else {
                    report("PASS: native write acknowledged");
                }
            });
        } else if (symbol == XKB_KEY_F2 && !readRequested) {
            readRequested = true;
            report("READ STARTED");
            clipboard->readText([this](std::optional<std::string> text) {
                if (mode == "stop-pending") {
                    readRejected = !text;
                    readCompleted = true;
                } else if (mode == "exchange") {
                    finish(text && *text == expected, "native read matches external bytes");
                } else {
                    finish(!text, "native read rejected without returning partial data");
                }
            });
        } else if (symbol == XKB_KEY_F3) {
            report("PONG");
        } else if (symbol == XKB_KEY_F4 && mode == "stop-pending") {
            const bool pending = !readCompleted;
            clipboard->stop();
            finish(pending && readCompleted && readRejected, "shutdown rejects pending native read");
            report("STOP COMPLETED");
        }
    }

    void attachKeyboard() {
        keyboard = wl_seat_get_keyboard(seat);
        static const wl_keyboard_listener listener{
            .keymap =
                [](void* data, wl_keyboard*, uint32_t format, int descriptor, uint32_t bytes) {
                    auto& probe = *static_cast<Probe*>(data);
                    if (format != WL_KEYBOARD_KEYMAP_FORMAT_XKB_V1 || bytes == 0 || bytes > 16 * 1024 * 1024) {
                        close(descriptor);
                        throw std::runtime_error("Unsupported keyboard map");
                    }
                    void* mapped = mmap(nullptr, bytes, PROT_READ, MAP_PRIVATE, descriptor, 0);
                    close(descriptor);
                    if (mapped == MAP_FAILED) {
                        throw std::runtime_error("Cannot map keyboard map");
                    }
                    xkb_keymap* next = nullptr;
                    if (static_cast<const char*>(mapped)[bytes - 1] == '\0') {
                        next = xkb_keymap_new_from_string(probe.keyContext, static_cast<const char*>(mapped),
                                                          XKB_KEYMAP_FORMAT_TEXT_V1, XKB_KEYMAP_COMPILE_NO_FLAGS);
                    }
                    munmap(mapped, bytes);
                    if (!next) {
                        throw std::runtime_error("Invalid keyboard map");
                    }
                    if (probe.keys) {
                        xkb_state_unref(probe.keys);
                    }
                    if (probe.keymap) {
                        xkb_keymap_unref(probe.keymap);
                    }
                    probe.keymap = next;
                    probe.keys = xkb_state_new(next);
                    if (!probe.keys) {
                        throw std::runtime_error("Cannot create keyboard state");
                    }
                },
            .enter = [](void* data, wl_keyboard*, uint32_t, wl_surface*,
                        wl_array*) { static_cast<Probe*>(data)->clipboard->setFocus(true); },
            .leave = [](void* data, wl_keyboard*, uint32_t,
                        wl_surface*) { static_cast<Probe*>(data)->clipboard->setFocus(false); },
            .key = [](void* data, wl_keyboard*, uint32_t serial, uint32_t, uint32_t key,
                      uint32_t state) { static_cast<Probe*>(data)->onKey(serial, key, state); },
            .modifiers =
                [](void* data, wl_keyboard*, uint32_t, uint32_t depressed, uint32_t latched, uint32_t locked,
                   uint32_t group) {
                    auto& probe = *static_cast<Probe*>(data);
                    if (probe.keys) {
                        xkb_state_update_mask(probe.keys, depressed, latched, locked, 0, 0, group);
                    }
                },
            .repeat_info = [](void*, wl_keyboard*, int32_t, int32_t) {},
        };
        wl_keyboard_add_listener(keyboard, &listener, this);
    }

    void draw() {
        if (width == drawnWidth && height == drawnHeight) {
            wl_surface_commit(surface);
            return;
        }
        if (width < 1 || height < 1 || width > 4096 || height > 4096) {
            throw std::runtime_error("Invalid window size");
        }
        auto buffer = std::make_unique<Buffer>();
        buffer->bytes = static_cast<size_t>(width) * height * 4;
        buffer->descriptor = memfd_create("symbiote-clipboard-probe", MFD_CLOEXEC);
        if (buffer->descriptor < 0 || ftruncate(buffer->descriptor, static_cast<off_t>(buffer->bytes)) != 0) {
            throw std::runtime_error("Cannot allocate window buffer");
        }
        buffer->pixels = mmap(nullptr, buffer->bytes, PROT_READ | PROT_WRITE, MAP_SHARED, buffer->descriptor, 0);
        if (buffer->pixels == MAP_FAILED) {
            throw std::runtime_error("Cannot map window buffer");
        }
        std::fill_n(static_cast<uint32_t*>(buffer->pixels), buffer->bytes / 4, uint32_t{0x00304f72});
        wl_shm_pool* pool = wl_shm_create_pool(sharedMemory, buffer->descriptor, static_cast<int>(buffer->bytes));
        if (!pool) {
            throw std::runtime_error("Cannot create window pool");
        }
        buffer->proxy = wl_shm_pool_create_buffer(pool, 0, width, height, width * 4, WL_SHM_FORMAT_XRGB8888);
        wl_shm_pool_destroy(pool);
        if (!buffer->proxy) {
            throw std::runtime_error("Cannot create window buffer");
        }
        wl_surface_attach(surface, buffer->proxy, 0, 0);
        wl_surface_damage(surface, 0, 0, width, height);
        wl_surface_commit(surface);
        buffers.push_back(std::move(buffer));
        drawnWidth = width;
        drawnHeight = height;
        report("READY");
    }

    void initialize(const char* copyFile, const char* readFileName, const char* selectedMode) {
        outgoing = readFile(copyFile);
        expected = readFile(readFileName);
        mode = selectedMode;
        if (mode != "exchange" && mode != "reject-read" && mode != "reject-write" && mode != "stop-pending") {
            throw std::runtime_error("Unknown clipboard probe mode");
        }
        if (!keyContext) {
            throw std::runtime_error("Cannot create keyboard context");
        }
        display = wl_display_connect(nullptr);
        if (!display) {
            throw std::runtime_error("Cannot connect to test compositor");
        }
        registry = wl_display_get_registry(display);
        static const wl_registry_listener globals{
            .global =
                [](void* data, wl_registry* registry, uint32_t name, const char* interface, uint32_t version) {
                    auto& probe = *static_cast<Probe*>(data);
                    if (std::strcmp(interface, "wl_compositor") == 0) {
                        probe.compositor =
                            static_cast<wl_compositor*>(wl_registry_bind(registry, name, &wl_compositor_interface, 4));
                    } else if (std::strcmp(interface, "wl_shm") == 0) {
                        probe.sharedMemory =
                            static_cast<wl_shm*>(wl_registry_bind(registry, name, &wl_shm_interface, 1));
                    } else if (std::strcmp(interface, "wl_data_device_manager") == 0) {
                        probe.manager = static_cast<wl_data_device_manager*>(wl_registry_bind(
                            registry, name, &wl_data_device_manager_interface, std::min(version, uint32_t{3})));
                    } else if (std::strcmp(interface, "xdg_wm_base") == 0) {
                        probe.shell = static_cast<xdg_wm_base*>(
                            wl_registry_bind(registry, name, &xdg_wm_base_interface, std::min(version, uint32_t{5})));
                    } else if (std::strcmp(interface, "wl_seat") == 0) {
                        probe.seat = static_cast<wl_seat*>(
                            wl_registry_bind(registry, name, &wl_seat_interface, std::min(version, uint32_t{5})));
                    }
                },
            .global_remove = [](void*, wl_registry*, uint32_t) {},
        };
        wl_registry_add_listener(registry, &globals, this);
        if (wl_display_roundtrip(display) < 0 || !compositor || !sharedMemory || !manager || !seat || !shell) {
            throw std::runtime_error("Missing compositor interfaces");
        }
        clipboard = std::make_shared<react_native_linux::WaylandClipboard>(display, manager, seat);
        manager = nullptr;
        static const wl_seat_listener seatListener{
            .capabilities =
                [](void* data, wl_seat*, uint32_t capabilities) {
                    auto& probe = *static_cast<Probe*>(data);
                    if ((capabilities & WL_SEAT_CAPABILITY_KEYBOARD) && !probe.keyboard) {
                        probe.attachKeyboard();
                    }
                    if (!(capabilities & WL_SEAT_CAPABILITY_KEYBOARD) && probe.keyboard) {
                        probe.clipboard->setFocus(false);
                        wl_keyboard_release(probe.keyboard);
                        probe.keyboard = nullptr;
                    }
                },
            .name = [](void*, wl_seat*, const char*) {},
        };
        wl_seat_add_listener(seat, &seatListener, this);
        static const xdg_wm_base_listener shellListener{
            .ping = [](void*, xdg_wm_base* shell, uint32_t serial) { xdg_wm_base_pong(shell, serial); },
        };
        xdg_wm_base_add_listener(shell, &shellListener, this);
        surface = wl_compositor_create_surface(compositor);
        shellSurface = xdg_wm_base_get_xdg_surface(shell, surface);
        static const xdg_surface_listener surfaceListener{
            .configure =
                [](void* data, xdg_surface* surface, uint32_t serial) {
                    xdg_surface_ack_configure(surface, serial);
                    static_cast<Probe*>(data)->draw();
                },
        };
        xdg_surface_add_listener(shellSurface, &surfaceListener, this);
        top = xdg_surface_get_toplevel(shellSurface);
        static const xdg_toplevel_listener topListener{
            .configure =
                [](void* data, xdg_toplevel*, int32_t width, int32_t height, wl_array*) {
                    auto& probe = *static_cast<Probe*>(data);
                    if (width > 0) {
                        probe.width = width;
                    }
                    if (height > 0) {
                        probe.height = height;
                    }
                },
            .close = [](void* data, xdg_toplevel*) { static_cast<Probe*>(data)->finish(false, "window closed early"); },
            .configure_bounds = [](void*, xdg_toplevel*, int32_t, int32_t) {},
            .wm_capabilities = [](void*, xdg_toplevel*, wl_array*) {},
        };
        xdg_toplevel_add_listener(top, &topListener, this);
        xdg_toplevel_set_title(top, "Symbiote clipboard verification");
        xdg_toplevel_set_app_id(top, "symbiote-clipboard-probe");
        wl_surface_commit(surface);
    }

    int run() {
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(25);
        while (!done && std::chrono::steady_clock::now() < deadline) {
            if (wl_display_dispatch_pending(display) < 0) {
                throw std::runtime_error("Display dispatch failed");
            }
            if (wl_display_prepare_read(display) != 0) {
                if (errno == EAGAIN) {
                    continue;
                }
                throw std::runtime_error("Display read preparation failed");
            }
            const int flushed = wl_display_flush(display);
            if (flushed < 0 && errno != EAGAIN) {
                wl_display_cancel_read(display);
                throw std::runtime_error("Display flush failed");
            }
            pollfd descriptor{wl_display_get_fd(display), static_cast<short>(POLLIN | (flushed < 0 ? POLLOUT : 0)), 0};
            const int result = poll(&descriptor, 1, 100);
            const int pollError = errno;
            if (result > 0 && (descriptor.revents & POLLIN)) {
                if (wl_display_read_events(display) < 0) {
                    throw std::runtime_error("Display read failed");
                }
            } else {
                wl_display_cancel_read(display);
            }
            if ((result < 0 && pollError != EINTR) || (descriptor.revents & (POLLERR | POLLHUP | POLLNVAL))) {
                throw std::runtime_error("Display poll failed");
            }
        }
        if (!done) {
            throw std::runtime_error("Clipboard probe timed out");
        }
        return failed ? 1 : 0;
    }
};

} // namespace

int main(int argc, char** argv) {
    Probe probe;
    try {
        if (argc != 4) {
            throw std::runtime_error("Expected copy file, expected-read file and mode");
        }
        probe.initialize(argv[1], argv[2], argv[3]);
        return probe.run();
    } catch (const std::exception& error) {
        std::cerr << "FAIL: " << error.what() << std::endl;
        return 1;
    }
}
