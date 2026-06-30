use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use serde::Serialize;
use tauri::{Emitter, Manager};

const EXTENSIONS: [&str; 6] = ["md", "mdx", "mdc", "mkd", "markdown", "txt"];

#[derive(Serialize, Clone)]
#[serde(untagged)]
enum Source {
    File { path: String, root: String, markdown: String },
    Folder { path: String, root: String, folder: bool },
}

#[derive(Serialize)]
struct Entry {
    title: String,
    href: String,
    folder: bool,
    active: bool,
}

#[derive(Default)]
struct AppState {
    ready: AtomicBool,
    pending: Mutex<Option<Source>>,
}

fn is_markdown(name: &str) -> bool {
    name.rsplit('.').next()
        .map(|ext| EXTENSIONS.iter().any(|known| known.eq_ignore_ascii_case(ext)))
        .unwrap_or(false)
        && name.contains('.')
}

fn canon(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn source(file: &str) -> Result<Source, String> {
    let path = canon(Path::new(file));
    let info = fs::metadata(&path).map_err(|error| error.to_string())?;
    let path = path.to_string_lossy().into_owned();
    if info.is_dir() {
        return Ok(Source::Folder { path: path.clone(), root: path, folder: true });
    }
    let markdown = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let root = Path::new(&path).parent().map(|dir| dir.to_string_lossy().into_owned()).unwrap_or_default();
    Ok(Source::File { path, root, markdown })
}

#[tauri::command]
fn read(path: String) -> Result<Source, String> {
    source(&path)
}

fn input(path: &str) -> bool {
    if path.starts_with('-') {
        return false;
    }
    match fs::metadata(path) {
        Ok(info) => info.is_dir() || is_markdown(path),
        Err(_) => is_markdown(path),
    }
}

fn argument() -> Option<String> {
    std::env::args().skip(1).find(|arg| input(arg))
}

#[tauri::command]
fn initial(state: tauri::State<AppState>) -> Option<Source> {
    state.ready.store(true, Ordering::SeqCst);
    state
        .pending
        .lock()
        .ok()?
        .take()
        .or_else(|| argument().and_then(|file| source(&file).ok()))
}

#[tauri::command]
fn folder(path: String, root: String, active: String) -> Result<Vec<Entry>, String> {
    let source = Path::new(&path);
    let info = fs::metadata(source).map_err(|error| error.to_string())?;
    let place = if info.is_dir() { source.to_path_buf() } else { source.parent().unwrap_or(source).to_path_buf() };
    let active = canon(Path::new(&active));

    let mut entries: Vec<Entry> = fs::read_dir(&place)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            let folder = entry.file_type().ok()?.is_dir();
            if !folder && !is_markdown(&name) {
                return None;
            }
            let href = place.join(&name);
            let active = canon(&href) == active;
            Some(Entry { title: name, href: href.to_string_lossy().into_owned(), folder, active })
        })
        .collect();

    entries.sort_by(|left, right| (right.folder as u8).cmp(&(left.folder as u8)).then_with(|| left.title.cmp(&right.title)));

    if canon(&place) == canon(Path::new(&root)) {
        return Ok(entries);
    }
    let parent = place.parent().map(|dir| dir.to_string_lossy().into_owned()).unwrap_or_default();
    let mut listing = vec![Entry { title: "..".into(), href: parent, folder: true, active: false }];
    listing.extend(entries);
    Ok(listing)
}

#[tauri::command]
async fn pick(app: tauri::AppHandle) -> Option<Source> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(choose());
    })
    .ok()?;
    source(&rx.recv().ok()??).ok()
}

// Native NSOpenPanel that accepts a file or a directory, matching the Electron picker.
#[cfg(target_os = "macos")]
fn choose() -> Option<String> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSOpenPanel;

    let panel = NSOpenPanel::openPanel(MainThreadMarker::new()?);
    panel.setCanChooseFiles(true);
    panel.setCanChooseDirectories(true);
    panel.setAllowsMultipleSelection(false);
    panel.setResolvesAliases(true);
    // NSModalResponseOK == 1
    if panel.runModal() != 1 {
        return None;
    }
    let path = panel.URL()?.path()?;
    Some(path.to_string())
}

#[tauri::command]
fn external(url: String) {
    let _ = std::process::Command::new("open").arg(url).spawn();
}

fn open_path(app: &tauri::AppHandle, path: &str) {
    let Ok(source) = source(path) else { return };
    let state = app.state::<AppState>();
    if state.ready.load(Ordering::SeqCst) {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit("open", source);
            return;
        }
    }
    let Ok(mut pending) = state.pending.lock() else { return };
    *pending = Some(source);
}

// Native NSAlert; returns the runModal response (NSAlertFirstButtonReturn == 1000).
#[cfg(target_os = "macos")]
fn alert(message: &str, informative: &str, buttons: &[&str]) -> isize {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSAlert;
    use objc2_foundation::NSString;

    let Some(mtm) = MainThreadMarker::new() else { return 0 };
    let alert = NSAlert::new(mtm);
    alert.setMessageText(&NSString::from_str(message));
    alert.setInformativeText(&NSString::from_str(informative));
    for title in buttons {
        alert.addButtonWithTitle(&NSString::from_str(title));
    }
    alert.runModal()
}

// Set the application icon at runtime so the Dock, About panel and dialogs show the
// feather even in `tauri dev`, where there is no .app bundle to read it from.
#[cfg(target_os = "macos")]
fn app_icon() {
    use objc2::{AnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let Some(mtm) = MainThreadMarker::new() else { return };
    let data = NSData::with_bytes(include_bytes!("../icons/128x128@2x.png"));
    let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) else { return };
    unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(Some(&image)) };
}

#[cfg(target_os = "macos")]
fn home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_default())
}

// The running .app bundle: …/Markity.app/Contents/MacOS/exe → Markity.app
#[cfg(target_os = "macos")]
fn bundle() -> Option<PathBuf> {
    std::env::current_exe().ok()?.ancestors().nth(3).map(Path::to_path_buf)
}

#[cfg(target_os = "macos")]
fn writable(dir: &Path) -> bool {
    let probe = dir.join(".mty-write-test");
    match fs::File::create(&probe) {
        Ok(_) => {
            let _ = fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
fn bin_target() -> Result<PathBuf, String> {
    let system = Path::new("/usr/local/bin");
    if writable(system) {
        return Ok(system.join("mty"));
    }
    let local = home().join(".local/bin");
    fs::create_dir_all(&local).map_err(|error| error.to_string())?;
    Ok(local.join("mty"))
}

#[cfg(target_os = "macos")]
fn install() -> Result<PathBuf, String> {
    use std::os::unix::fs::PermissionsExt;

    let bundle = bundle().ok_or("Could not locate the app bundle.")?;
    let bin = bin_target()?;
    let script = format!(
        r#"#!/bin/zsh
app={bundle:?}
args=()
if (($# == 0)); then
  args+=("$PWD")
else
  for path in "$@"; do
    [[ "$path" = /* ]] && args+=("$path") || args+=("$PWD/$path")
  done
fi
exec /usr/bin/open -n "$app" --args "${{args[@]}}"
"#
    );
    fs::write(&bin, script).map_err(|error| error.to_string())?;
    fs::set_permissions(&bin, fs::Permissions::from_mode(0o755)).map_err(|error| error.to_string())?;
    Ok(bin)
}

// Offer to copy the bundle into /Applications, then relaunch from there.
#[cfg(target_os = "macos")]
fn place(app: &tauri::App) {
    let Some(bundle) = bundle() else { return };
    if !bundle.exists() || bundle.extension().and_then(|ext| ext.to_str()) != Some("app") {
        return;
    }
    if bundle.to_string_lossy().contains("/Applications/") {
        return;
    }
    if alert(
        "Move Markity to Applications?",
        "Markity can install itself in Applications before opening.",
        &["Move to Applications", "Not Now"],
    ) != 1000
    {
        return;
    }

    let Some(name) = bundle.file_name() else { return };
    let dest = Path::new("/Applications").join(name);
    // Copy to a staging path, then swap into place, so a failed copy never leaves
    // /Applications empty and the new copy never depends on the running source.
    let staging = Path::new("/Applications").join(".markity-install.app");
    let _ = fs::remove_dir_all(&staging);
    let staged = std::process::Command::new("/usr/bin/ditto")
        .arg(&bundle)
        .arg(&staging)
        .status()
        .map(|status| status.success())
        .unwrap_or(false);
    let installed = staged && {
        let _ = fs::remove_dir_all(&dest);
        fs::rename(&staging, &dest).is_ok()
    };
    if !installed {
        let _ = fs::remove_dir_all(&staging);
        alert("Install failed", "Could not copy Markity to Applications.", &["OK"]);
        return;
    }
    // Drop the quarantine flag so the moved copy runs in place. Otherwise Gatekeeper
    // translocates it to a random read-only path, current_exe() never reports
    // /Applications, and this prompt loops — eventually deleting the copy it runs from.
    let _ = std::process::Command::new("/usr/bin/xattr")
        .args(["-dr", "com.apple.quarantine"])
        .arg(&dest)
        .status();
    let _ = std::process::Command::new("/usr/bin/open").arg("-n").arg(&dest).spawn();
    app.handle().exit(0);
}

#[cfg(target_os = "macos")]
fn menu(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{AboutMetadataBuilder, Menu, MenuItem, PredefinedMenuItem, Submenu};

    let handle = app.handle();
    let about = AboutMetadataBuilder::new()
        .name(Some("Markity"))
        .version(Some(env!("CARGO_PKG_VERSION")))
        .icon(handle.default_window_icon().cloned())
        .build();
    let app_menu = Submenu::with_items(
        handle,
        "Markity",
        true,
        &[
            &PredefinedMenuItem::about(handle, None, Some(about))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::show_all(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;
    let file_menu = Submenu::with_items(
        handle,
        "File",
        true,
        &[
            &MenuItem::with_id(handle, "open", "Open…", true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(handle, "install", "Install CLI", true, None::<&str>)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::close_window(handle, None)?,
        ],
    )?;
    let edit_menu = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;
    let view_menu = Submenu::with_items(
        handle,
        "View",
        true,
        &[
            &PredefinedMenuItem::fullscreen(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "devtools", "Developer Tools", true, Some("F12"))?,
        ],
    )?;
    let window_menu = Submenu::with_items(
        handle,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(handle, None)?,
            &PredefinedMenuItem::close_window(handle, None)?,
        ],
    )?;

    let menu = Menu::with_items(handle, &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])?;
    app.set_menu(menu)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                app_icon();
                place(app);
                menu(app)?;
            }
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                #[cfg(target_os = "macos")]
                if let Some(path) = choose() {
                    open_path(app, &path);
                }
            }
            "install" => {
                #[cfg(target_os = "macos")]
                match install() {
                    Ok(bin) => {
                        alert(
                            "Command-line tool installed",
                            &format!("Run  mty <file>  in any terminal to open Markdown in Markity.\n\nInstalled at {}", bin.display()),
                            &["OK"],
                        );
                    }
                    Err(error) => {
                        alert("CLI install failed", &error, &["OK"]);
                    }
                }
            }
            "devtools" => {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_devtools_open() {
                        window.close_devtools();
                    } else {
                        window.open_devtools();
                    }
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![initial, read, folder, pick, external])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                let Some(path) = urls.into_iter().find_map(|url| url.to_file_path().ok()) else { return };
                open_path(app, &path.to_string_lossy());
            }
        });
}
