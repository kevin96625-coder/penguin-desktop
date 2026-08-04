//! Penguin server lifecycle: adopt precheck, runtime detection, spawn.

use std::fs::File;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::Manager;

const PORT: u16 = 7364;
const PROBE_TIMEOUT: Duration = Duration::from_secs(1);

#[derive(Default)]
pub struct ServerState {
    pub child: Option<Child>,
    pub owned: bool,
}

pub type SharedServerState = Mutex<ServerState>;

/// Path of the log file the spawned server's stdout/stderr are redirected to.
pub fn log_path() -> PathBuf {
    std::env::temp_dir().join("penguin-desktop-server.log")
}

/// Single HTTP probe against http://localhost:7364/ with ~1s connect and read
/// timeouts. Any HTTP status line (including redirects) counts as success; we
/// never follow redirects. Returns false on connect failure, read timeout, or
/// a non-HTTP response (e.g. the port is held by a non-HTTP program).
fn probe_http() -> bool {
    let addrs = match format!("localhost:{PORT}").to_socket_addrs() {
        Ok(a) => a,
        Err(_) => return false,
    };
    for addr in addrs {
        let mut stream = match TcpStream::connect_timeout(&addr, PROBE_TIMEOUT) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let _ = stream.set_read_timeout(Some(PROBE_TIMEOUT));
        let _ = stream.set_write_timeout(Some(PROBE_TIMEOUT));
        if stream
            .write_all(b"GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
            .is_err()
        {
            continue;
        }
        // Read until we have enough bytes to recognize an HTTP status line.
        let mut buf = Vec::with_capacity(16);
        let mut chunk = [0u8; 16];
        loop {
            match stream.read(&mut chunk) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    buf.extend_from_slice(&chunk[..n]);
                    if buf.len() >= 5 {
                        break;
                    }
                }
                Err(_) => break, // read timeout: not an HTTP responder
            }
        }
        if buf.starts_with(b"HTTP/") {
            return true;
        }
    }
    false
}

enum RuntimeKind {
    /// Node >= 24: run the vendored server dist directly.
    Node(PathBuf),
    /// Official penguin launcher (bundles its own node).
    PenguinLauncher(PathBuf),
}

/// Parse `node -v` output ("v25.8.2") and check major version >= 24.
fn node_major_ok(node: &Path) -> bool {
    let Ok(out) = Command::new(node).arg("-v").output() else {
        return false;
    };
    if !out.status.success() {
        return false;
    }
    let v = String::from_utf8_lossy(&out.stdout);
    v.trim()
        .trim_start_matches('v')
        .split('.')
        .next()
        .and_then(|major| major.parse::<u32>().ok())
        .map(|major| major >= 24)
        .unwrap_or(false)
}

/// Runtime detection, strictly in order:
/// a. ~/.penguin/node/bin/node (>= 24)
/// b. /opt/homebrew/bin/node (>= 24)
/// c. ~/.penguin/bin/penguin (official launcher)
/// d. none -> error
fn detect_runtime() -> Result<RuntimeKind, String> {
    let home = std::env::var_os("HOME").map(PathBuf::from);

    if let Some(home) = &home {
        let penguin_node = home.join(".penguin/node/bin/node");
        if penguin_node.is_file() && node_major_ok(&penguin_node) {
            return Ok(RuntimeKind::Node(penguin_node));
        }
    }

    let brew_node = PathBuf::from("/opt/homebrew/bin/node");
    if brew_node.is_file() && node_major_ok(&brew_node) {
        return Ok(RuntimeKind::Node(brew_node));
    }

    if let Some(home) = &home {
        let penguin = home.join(".penguin/bin/penguin");
        if penguin.is_file() {
            return Ok(RuntimeKind::PenguinLauncher(penguin));
        }
    }

    Err("未找到可用的运行时：需要 Node 24+（~/.penguin/node 或 /opt/homebrew/bin/node）\
         或官方 penguin 安装（~/.penguin/bin/penguin）。"
        .to_string())
}

/// Absolute path to the vendored server entry (dev layout, resolved from the
/// crate manifest dir).
fn server_dist_path() -> Result<PathBuf, String> {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../vendor/penguin-harness/packages/server/dist/index.js");
    p.canonicalize().map_err(|_| {
        format!(
            "penguin server 构建产物不存在：{}\n请先运行 scripts/build-harness.sh。",
            p.display()
        )
    })
}

/// Where the shipped harness and frontend live inside the .app bundle.
///
/// Release resolves both out of `resource_dir()`; the entry is the flattened CLI from
/// `scripts/bundle-harness.sh`, which is started with the `server` subcommand (the raw
/// server entry is not part of the CLI deploy tree). Dev keeps the submodule layout and
/// leaves `PENGUIN_WEB_DIST` unset, so the server serves the official web UI and our
/// frontend is served by Vite instead.
struct BundlePaths {
    entry: PathBuf,
    web_dist: PathBuf,
}

fn bundle_paths(app: &tauri::AppHandle) -> Result<BundlePaths, String> {
    use tauri::Manager;
    let res = app
        .path()
        .resource_dir()
        .map_err(|e| format!("无法解析资源目录: {e}"))?;
    // Resources declared with a `../` prefix are re-rooted under `_up_` inside the
    // bundle, so both candidates are checked rather than assuming either layout.
    let roots = [res.join("_up_"), res.clone()];
    for root in &roots {
        let entry = root.join("dist-harness/dist/index.js");
        if entry.is_file() {
            return Ok(BundlePaths {
                web_dist: root.join("dist"),
                entry,
            });
        }
    }
    Err(format!(
        "打包内的 penguin server 不存在：{}\n请先运行 scripts/bundle-harness.sh 再打包。",
        roots[0].join("dist-harness/dist/index.js").display()
    ))
}

/// Spawn the penguin server in its own process group, stdout/stderr redirected
/// to the log file. Never binds anything itself; PORT/HOST are passed via env.
fn spawn_server(app: &tauri::AppHandle) -> Result<Child, String> {
    let runtime = detect_runtime()?;
    let bundled = if cfg!(debug_assertions) {
        None
    } else {
        Some(bundle_paths(app)?)
    };

    let log = File::create(log_path())
        .map_err(|e| format!("无法创建日志文件 {}: {e}", log_path().display()))?;
    let log_err = log
        .try_clone()
        .map_err(|e| format!("无法复制日志文件句柄: {e}"))?;

    let mut cmd = match (&bundled, runtime) {
        // Release + a real Node: run the flattened CLI's `server` subcommand.
        (Some(paths), RuntimeKind::Node(node)) => {
            let mut c = Command::new(node);
            c.arg("--disable-warning=ExperimentalWarning")
                .arg(&paths.entry)
                .args(["server", "--port", "7364"]);
            c
        }
        (None, RuntimeKind::Node(node)) => {
            let dist = server_dist_path()?;
            let mut c = Command::new(node);
            c.arg("--disable-warning=ExperimentalWarning").arg(dist);
            c
        }
        // The official launcher brings its own harness; the bundled copy is unused.
        (_, RuntimeKind::PenguinLauncher(penguin)) => {
            let mut c = Command::new(penguin);
            c.args(["server", "--port", "7364"]);
            c
        }
    };

    // Same-origin hosting of OUR frontend: without this the server would fall back to
    // the official web UI baked into the harness.
    if let Some(paths) = &bundled {
        cmd.env("PENGUIN_WEB_DIST", &paths.web_dist);
    }

    cmd.env("PORT", "7364")
        .env("HOST", "127.0.0.1")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(log_err))
        .process_group(0); // child becomes its own process group leader

    cmd.spawn().map_err(|e| format!("启动 penguin server 失败: {e}"))
}

/// Show a blocking error dialog (off the main thread; the plugin dispatches to
/// the main thread internally) and then exit the app.
fn fatal(app: tauri::AppHandle, msg: String) {
    std::thread::spawn(move || {
        use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
        app.dialog()
            .message(&msg)
            .kind(MessageDialogKind::Error)
            .title("penguin-desktop 启动失败")
            .blocking_show();
        app.exit(1);
    });
}

/// Last `n` lines of the server log, for failure diagnostics.
fn log_tail(n: usize) -> String {
    let Ok(content) = std::fs::read_to_string(log_path()) else {
        return String::from("(无日志)");
    };
    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(n);
    lines[start..].join("\n")
}

/// Poll GET http://localhost:7364/ every 100ms, up to 150 attempts; each
/// attempt has its own ~1s connect/read timeouts (a non-HTTP occupant of the
/// port would otherwise hang the poll forever). Any HTTP status line (302
/// included) counts as ready; redirects are not followed. On ready: reload the
/// main window (its initial load happened before the server was up), then show
/// and focus it. On timeout: error dialog with the log tail, then exit.
fn spawn_ready_watch(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ready = false;
        for _ in 0..150 {
            if probe_http() {
                ready = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }

        if !ready {
            let msg = format!(
                "penguin server 未在预期时间内就绪 (http://localhost:7364)。\n\n\
                 日志尾部 ({}):\n{}",
                log_path().display(),
                log_tail(20)
            );
            fatal(app, msg);
            return;
        }

        eprintln!("[penguin] server ready, looking for main window…");

        // The window may still be racing app initialization; retry briefly.
        for attempt in 0..50u32 {
            if attempt == 0 || attempt % 10 == 0 || attempt == 49 {
                eprintln!(
                    "[penguin] windows: {:?}",
                    app.webview_windows().keys().collect::<Vec<_>>()
                );
            }
            if let Some(window) = app.get_webview_window("main") {
                /*
                 * Release: navigate explicitly to the server origin.
                 *
                 * A URL `frontendDist` does NOT get the release window onto that origin —
                 * the webview comes up on the internal tauri:// document with nothing
                 * embedded (nothing is, precisely because frontendDist is a URL), which
                 * renders as a blank white page and never requests a single asset. A
                 * `reload()` then just reloads that empty document.
                 *
                 * Navigating here rather than pinning `windows[0].url` in the config keeps
                 * dev on the Vite devUrl, which the config field would override and break HMR.
                 */
                #[cfg(not(debug_assertions))]
                {
                    match format!("http://localhost:{PORT}").parse() {
                        Ok(url) => {
                            let _ = window.navigate(url);
                        }
                        Err(e) => eprintln!("[penguin] bad server url: {e}"),
                    }
                }
                #[cfg(debug_assertions)]
                let _ = window.reload();

                let _ = window.show();
                let _ = window.set_focus();
                eprintln!(
                    "[penguin] window '{}' shown, visible={:?}",
                    window.label(),
                    window.is_visible()
                );
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        fatal(app, "main window not found after server ready".into());
    });
}

/// Idempotent server teardown. Safe to call from multiple exit trigger points
/// (CloseRequested / ExitRequested / Exit): `child.take()` ensures only the
/// first caller does any work; an adopted (`owned == false`) external server
/// is never killed. Kills the whole process group (SIGTERM, up to 6s of
/// try_wait polling, then SIGKILL) — pid == pgid because of process_group(0).
pub fn cleanup(state: &SharedServerState) {
    let (child, owned) = {
        let mut guard = state.lock().unwrap();
        let owned = guard.owned;
        (guard.child.take(), owned)
    };
    let Some(mut child) = child else {
        return; // already cleaned up, never spawned, or adopted (child = None)
    };
    if !owned {
        return;
    }

    let pid = child.id() as libc::pid_t;
    unsafe {
        libc::killpg(pid, libc::SIGTERM);
    }

    // Poll for graceful exit: every 200ms, up to 6s.
    for _ in 0..30 {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => std::thread::sleep(Duration::from_millis(200)),
            Err(_) => return,
        }
    }

    unsafe {
        libc::killpg(pid, libc::SIGKILL);
    }
    let _ = child.wait();
}

/// Entry point, called from setup. Adopt precheck -> spawn if needed.
pub fn start(app: tauri::AppHandle) {
    // Adopt precheck: if anything already answers HTTP on the port, an
    // external server is running. Use it, and never kill it on exit.
    if probe_http() {
        {
            let state = app.state::<SharedServerState>();
            let mut guard = state.lock().unwrap();
            guard.child = None;
            guard.owned = false;
        }
        spawn_ready_watch(app);
        return;
    }

    match spawn_server(&app) {
        Ok(child) => {
            {
                let state = app.state::<SharedServerState>();
                let mut guard = state.lock().unwrap();
                guard.child = Some(child);
                guard.owned = true;
            }
            spawn_ready_watch(app);
        }
        Err(msg) => fatal(app, msg),
    }
}
