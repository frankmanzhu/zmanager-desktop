#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod account;
mod archive_file_types;
mod archive_index;
mod commands;
mod constants;
mod default_handlers;
mod diagnostics;
mod dto;
mod error;
mod job_dto;
mod job_registry;
mod native_drag_session;
mod native_integration;
mod native_launch_inbox;
mod platform;
mod quick_action;
mod replacement_migration;

use tauri::{Emitter, Manager};

fn main() {
    let diagnostics = diagnostics::DiagnosticLog::new();
    let native_launch_inbox = native_launch_inbox::NativeLaunchInbox::new();
    let startup_window_state = quick_action::QuickActionStartupState::from_startup_env();
    record_launch_classification(&diagnostics, "primaryProcess", &startup_window_state);
    let legacy_startup_state =
        startup_window_state.forward_requested_to_native_inbox(&native_launch_inbox);
    platform::initialize_native_host(native_launch_inbox.clone(), diagnostics.clone())
        .expect("failed to initialize native host before Tauri startup");
    let job_registry = job_registry::JobRegistry::new();
    let archive_index_registry = archive_index::ArchiveIndexRegistry::new();
    let account_runtime = account::AccountRuntime::new();
    let native_drag_sessions = native_drag_session::NativeDragSessionRegistry::new();
    let quick_action_launch_coordinator =
        quick_action::QuickActionLaunchCoordinator::from_startup_state(legacy_startup_state);
    let single_instance_coordinator = quick_action_launch_coordinator.clone();
    let single_instance_inbox = native_launch_inbox.clone();
    let setup_inbox = native_launch_inbox.clone();
    let exit_inbox = native_launch_inbox.clone();
    let single_instance_diagnostics = diagnostics.clone();
    let setup_diagnostics = diagnostics.clone();
    let exit_diagnostics = diagnostics.clone();

    let builder = tauri::Builder::default();
    let builder = platform::register_platform_services(builder);
    let app = builder
        .manage(job_registry)
        .manage(archive_index_registry)
        .manage(account_runtime)
        .manage(native_drag_sessions.clone())
        .manage(diagnostics.clone())
        .manage(quick_action_launch_coordinator)
        .manage(native_launch_inbox.clone())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(
            move |_app, argv, _cwd| {
                record_secondary_arguments(&single_instance_diagnostics, &argv);
                let state = single_instance_coordinator.ingest_secondary_process_args(
                    argv.into_iter().map(std::ffi::OsString::from).collect(),
                    &single_instance_inbox,
                );
                record_launch_classification(
                    &single_instance_diagnostics,
                    "secondaryProcess",
                    &state,
                );
            },
        ))
        .setup(move |app| {
            let _ = setup_diagnostics.initialize(app.path().app_log_dir().ok());
            let emitter_app = app.handle().clone();
            setup_inbox
                .attach_emitter(std::sync::Arc::new(move |window, event| {
                    emitter_app
                        .emit_to(
                            window,
                            native_launch_inbox::NATIVE_INBOUND_EVENT_NAME,
                            event,
                        )
                        .map_err(|error| error.to_string())
                }))
                .map_err(|error| {
                    std::io::Error::other(format!(
                        "failed to attach native inbox emitter: {error:?}"
                    ))
                })?;
            if let Some(window) = app.get_webview_window("main") {
                platform::configure_main_window(&window)?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let window_class = if window.label() == "main" {
                    "main"
                } else if window.label().starts_with("task-") {
                    "disposableTask"
                } else {
                    "other"
                };
                let _ = window.state::<diagnostics::DiagnosticLog>().record(
                    "window",
                    "destroyed",
                    diagnostics::fields([(
                        "windowClass",
                        serde_json::Value::String(window_class.to_string()),
                    )]),
                );
                window
                    .state::<job_registry::JobRegistry>()
                    .cleanup_owner_subscriptions(window.label());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::healthcheck,
            commands::project_contract,
            commands::system_file_icons,
            default_handlers::default_handler_status,
            default_handlers::default_handler_set,
            default_handlers::default_handler_restore,
            replacement_migration::replacement_migration_prepare,
            replacement_migration::replacement_migration_complete,
            commands::validate_directory,
            diagnostics::record_diagnostic_event,
            diagnostics::diagnostic_log_info,
            commands::quick_action_startup_state,
            commands::native_frontend_ready,
            commands::acknowledge_native_event,
            account::account_snapshot,
            account::account_begin_hosted_auth,
            account::account_apply_hosted_callback,
            account::account_forget,
            account::account_generate_recipient_key,
            account::account_remove_recipient_key,
            account::account_remove_contact,
            commands::start_archive_index,
            commands::wait_archive_index,
            commands::get_archive_children,
            commands::search_archive_index,
            commands::close_archive_index,
            commands::plan_create,
            commands::start_create,
            commands::start_extract,
            commands::verify_tzap_certificate,
            commands::generate_tzap_identity,
            commands::preview_entry,
            commands::start_native_file_drag,
            commands::cleanup_preview_roots,
            commands::test_archive,
            commands::subscribe_job,
            commands::subscribe_job_catalog,
            commands::ack_subscription,
            commands::unsubscribe_job,
            commands::cancel_job,
            commands::pause_job,
            commands::resume_job,
            commands::dismiss_job
        ])
        .build(tauri::generate_context!())
        .expect("failed to build ZManager desktop");
    app.run(move |_app_handle, event| {
        platform::handle_run_event(&event, &native_launch_inbox);
        match event {
            tauri::RunEvent::Exit => {
                let _ = exit_diagnostics.record("process", "exit", diagnostics::fields([]));
                exit_inbox.shutdown();
                native_drag_sessions.shutdown();
                platform::shutdown();
            }
            _ => {}
        }
    });
}

fn record_launch_classification(
    diagnostics: &diagnostics::DiagnosticLog,
    source: &str,
    state: &quick_action::QuickActionStartupState,
) {
    let (classification, action, path_count) = match state {
        quick_action::QuickActionStartupState::NotRequested => ("normal", None, 0),
        quick_action::QuickActionStartupState::Requested(request) => (
            "quickAction",
            serde_json::to_value(&request.kind)
                .ok()
                .and_then(|value| value.as_str().map(str::to_owned)),
            request.paths.len(),
        ),
        quick_action::QuickActionStartupState::ForwardedToNativeInbox(kind) => (
            "quickActionForwarded",
            serde_json::to_value(kind)
                .ok()
                .and_then(|value| value.as_str().map(str::to_owned)),
            0,
        ),
        quick_action::QuickActionStartupState::Invalid(_) => ("invalid", None, 0),
        quick_action::QuickActionStartupState::PendingMacOsQuickAction => {
            ("pendingMacOsQuickAction", None, 0)
        }
    };
    let _ = diagnostics.record(
        "launch",
        "classified",
        diagnostics::fields([
            ("source", serde_json::Value::String(source.to_string())),
            (
                "classification",
                serde_json::Value::String(classification.to_string()),
            ),
            (
                "action",
                action
                    .map(serde_json::Value::String)
                    .unwrap_or(serde_json::Value::Null),
            ),
            ("pathCount", serde_json::json!(path_count)),
        ]),
    );
}

fn record_secondary_arguments(diagnostics: &diagnostics::DiagnosticLog, args: &[String]) {
    let _ = diagnostics.record(
        "launch",
        "secondaryArgumentsObserved",
        diagnostics::fields([
            ("argumentCount", serde_json::json!(args.len())),
            (
                "hasQuickActionArgument",
                serde_json::json!(args.iter().any(|arg| {
                    arg == "--quick-action"
                        || arg == "--action"
                        || arg.starts_with("--quick-action=")
                        || arg.starts_with("--action=")
                })),
            ),
            (
                "hasRequestArgument",
                serde_json::json!(args.iter().any(|arg| {
                    arg == "--quick-action-request"
                        || arg == "--shell-action-request"
                        || arg.starts_with("--quick-action-request=")
                        || arg.starts_with("--shell-action-request=")
                })),
            ),
            (
                "hasPathArgument",
                serde_json::json!(
                    args.iter()
                        .any(|arg| arg == "--path" || arg.starts_with("--path="))
                ),
            ),
        ]),
    );
}
