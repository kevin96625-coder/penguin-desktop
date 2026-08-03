mod server;

use std::sync::Mutex;

use tauri::{Manager, RunEvent, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(Mutex::new(server::ServerState::default()));
            server::start(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Trigger point 1/3: window close (redundant with the run-event
            // triggers below; cleanup is idempotent).
            if let WindowEvent::CloseRequested { .. } = event {
                server::cleanup(&window.state::<server::SharedServerState>());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| match event {
        // Trigger points 2/3 and 3/3: app exit (covers macOS Cmd+Q, which
        // historically bypassed window close events).
        RunEvent::ExitRequested { .. } | RunEvent::Exit => {
            server::cleanup(&app_handle.state::<server::SharedServerState>());
        }
        _ => {}
    });
}
