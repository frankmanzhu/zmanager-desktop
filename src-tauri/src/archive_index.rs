use std::cmp::Ordering;
use std::collections::{BTreeSet, HashMap};
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tokio::sync::watch;
use zmanager_core::archive_browser::{self, BrowserEntry, BrowserListOptions};

use crate::dto::{
    ArchiveChildrenPageDto, ArchiveChildrenRequest, ArchiveEntryDto, ArchiveEntryKindDto,
    ArchiveIndexSnapshotDto, ArchiveIndexStartResponseDto, ArchiveIndexStatusDto,
    ArchiveSearchRequest, StartArchiveIndexRequest,
};
use crate::error::CommandErrorDto;

const MAX_ACTIVE_ARCHIVE_SESSIONS: usize = 4;
const MAX_ARCHIVE_INDEX_ENTRIES: usize = 500_000;
const MAX_ARCHIVE_INDEX_METADATA_BYTES: usize = 256 * 1024 * 1024;
const DEFAULT_ARCHIVE_PAGE_SIZE: usize = 200;
const MAX_ARCHIVE_PAGE_SIZE: usize = 512;
const ARCHIVE_INDEX_PUBLICATION_BATCH: usize = 256;
const ARCHIVE_INDEX_PUBLICATION_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Clone)]
pub struct ArchiveIndexRegistry {
    state: Arc<Mutex<RegistryState>>,
}

struct RegistryState {
    next_session_id: u64,
    sessions: HashMap<String, SessionRecord>,
}

struct SessionRecord {
    snapshot: Arc<ArchiveIndexSnapshotDto>,
    sender: watch::Sender<Arc<ArchiveIndexSnapshotDto>>,
    index: Arc<Mutex<ArchiveIndex>>,
    cancelled: Arc<AtomicBool>,
}

struct ArchiveIndex {
    entries: HashMap<String, ArchiveEntryDto>,
    children: HashMap<String, BTreeSet<String>>,
    entry_count: usize,
    total_bytes: u64,
    has_total: bool,
    estimated_metadata_bytes: usize,
}

impl ArchiveIndexRegistry {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(RegistryState {
                next_session_id: 0,
                sessions: HashMap::new(),
            })),
        }
    }

    pub fn start(
        &self,
        request: StartArchiveIndexRequest,
    ) -> Result<ArchiveIndexStartResponseDto, CommandErrorDto> {
        let archive_path = request.archive_path.trim().to_string();
        if archive_path.is_empty() {
            return Err(CommandErrorDto::invalid_request(
                "archivePath cannot be empty",
            ));
        }
        let password = request
            .password
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());

        let (session_id, snapshot, cancelled, index) = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if state.sessions.len() >= MAX_ACTIVE_ARCHIVE_SESSIONS {
                return Err(CommandErrorDto::operation_failed(
                    "Too many archives are currently opening. Close an archive and try again.",
                ));
            }
            state.next_session_id = state.next_session_id.checked_add(1).ok_or_else(|| {
                CommandErrorDto::operation_failed("Archive session IDs exhausted.")
            })?;
            let session_id = format!("archive-{}", state.next_session_id);
            let snapshot = Arc::new(ArchiveIndexSnapshotDto {
                revision: "1".to_string(),
                session_id: session_id.clone(),
                archive_path: archive_path.clone(),
                status: ArchiveIndexStatusDto::Indexing,
                discovered_entries: 0,
                discovered_bytes: None,
                final_entry_count: None,
                final_total_bytes: None,
                latest_failure: None,
            });
            let (sender, _) = watch::channel(snapshot.clone());
            let cancelled = Arc::new(AtomicBool::new(false));
            let index = Arc::new(Mutex::new(ArchiveIndex::new()));
            state.sessions.insert(
                session_id.clone(),
                SessionRecord {
                    snapshot: snapshot.clone(),
                    sender,
                    index: index.clone(),
                    cancelled: cancelled.clone(),
                },
            );
            (session_id, snapshot, cancelled, index)
        };

        let registry = self.clone();
        let spawn_failure_registry = self.clone();
        let worker_session_id = session_id.clone();
        let spawn_failure_session_id = session_id.clone();
        if let Err(error) = thread::Builder::new()
            .name("archive-index".to_string())
            .spawn(move || {
                let mut last_publication = Instant::now();
                let mut unpublished_entries = 0;
                let mut index_error = None;
                let result = archive_browser::visit_entries_with_options(
                    Path::new(&archive_path),
                    BrowserListOptions {
                        password: password.as_deref(),
                    },
                    |entry| {
                        if cancelled.load(AtomicOrdering::Acquire) {
                            return false;
                        }
                        let insertion = index
                            .lock()
                            .unwrap_or_else(|error| error.into_inner())
                            .insert(entry);
                        if let Err(error) = insertion {
                            index_error = Some(error);
                            return false;
                        }
                        unpublished_entries += 1;
                        if unpublished_entries >= ARCHIVE_INDEX_PUBLICATION_BATCH
                            || last_publication.elapsed() >= ARCHIVE_INDEX_PUBLICATION_INTERVAL
                        {
                            let statistics = index
                                .lock()
                                .unwrap_or_else(|error| error.into_inner())
                                .statistics();
                            registry.publish_progress(&worker_session_id, statistics);
                            unpublished_entries = 0;
                            last_publication = Instant::now();
                        }
                        true
                    },
                )
                .map(|_| {
                    index
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .statistics()
                })
                .map_err(crate::commands::map_archive_browser_error);
                if cancelled.load(AtomicOrdering::Acquire) {
                    return;
                }
                registry.finish(&worker_session_id, index_error.map_or(result, Err));
            })
        {
            spawn_failure_registry.finish(
                &spawn_failure_session_id,
                Err(CommandErrorDto::operation_failed(format!(
                    "Archive indexing worker could not start: {error}"
                ))),
            );
        }

        Ok(ArchiveIndexStartResponseDto {
            session_id,
            snapshot: (*snapshot).clone(),
        })
    }

    pub async fn wait_for_change(
        &self,
        session_id: &str,
        after_revision: Option<&str>,
    ) -> Result<ArchiveIndexSnapshotDto, CommandErrorDto> {
        let mut receiver = {
            let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state
                .sessions
                .get(session_id)
                .map(|record| record.sender.subscribe())
                .ok_or_else(|| archive_session_not_found(session_id))?
        };
        loop {
            let snapshot = receiver.borrow().clone();
            if after_revision.is_none_or(|revision| revision != snapshot.revision)
                || snapshot.status != ArchiveIndexStatusDto::Indexing
            {
                return Ok((*snapshot).clone());
            }
            receiver
                .changed()
                .await
                .map_err(|_| archive_session_not_found(session_id))?;
        }
    }

    pub fn children(
        &self,
        request: ArchiveChildrenRequest,
    ) -> Result<ArchiveChildrenPageDto, CommandErrorDto> {
        let parent_path = normalize_archive_path(&request.parent_path);
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let record = state
            .sessions
            .get(&request.session_id)
            .ok_or_else(|| archive_session_not_found(&request.session_id))?;
        if let Some(expected) = request.expected_revision.as_deref()
            && expected != record.snapshot.revision
        {
            return Err(CommandErrorDto::invalid_request(
                "Archive page revision is stale; request the current page again.",
            ));
        }
        if record.snapshot.status == ArchiveIndexStatusDto::Failed {
            return Err(record
                .snapshot
                .latest_failure
                .clone()
                .unwrap_or_else(|| CommandErrorDto::operation_failed("Archive indexing failed.")));
        }
        let index = record
            .index
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut paths = index
            .children
            .get(&parent_path)
            .map(|paths| paths.iter().cloned().collect::<Vec<_>>())
            .unwrap_or_default();
        let sort_key = request.sort_key.as_deref().unwrap_or("name");
        let ascending = request.sort_ascending.unwrap_or(true);
        paths.sort_by(|left, right| {
            compare_paths_by_sort(left, right, &index.entries, sort_key, ascending)
        });
        let cursor_scope = format!("{parent_path}\0{sort_key}\0{ascending}");
        let limit = request
            .limit
            .unwrap_or(DEFAULT_ARCHIVE_PAGE_SIZE)
            .clamp(1, MAX_ARCHIVE_PAGE_SIZE);
        let offset = decode_cursor(
            request.cursor.as_deref(),
            &request.session_id,
            &cursor_scope,
            &record.snapshot.revision,
        )?;
        if offset > paths.len() {
            return Err(CommandErrorDto::invalid_request(
                "Archive page cursor is out of range.",
            ));
        }
        let end = offset.saturating_add(limit).min(paths.len());
        let entries = paths[offset..end]
            .iter()
            .filter_map(|path| index.entries.get(path).cloned())
            .collect();
        let next_cursor = (end < paths.len()).then(|| {
            encode_cursor(
                &request.session_id,
                &cursor_scope,
                &record.snapshot.revision,
                end,
            )
        });
        Ok(ArchiveChildrenPageDto {
            session_id: request.session_id,
            revision: record.snapshot.revision.clone(),
            parent_path,
            entries,
            next_cursor,
            complete: end == paths.len(),
            child_count: paths.len(),
        })
    }

    pub fn close(&self, session_id: &str) -> Result<(), CommandErrorDto> {
        let record = self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .sessions
            .remove(session_id)
            .ok_or_else(|| archive_session_not_found(session_id))?;
        record.cancelled.store(true, AtomicOrdering::Release);
        let cancelled = Arc::new(ArchiveIndexSnapshotDto {
            revision: next_revision(&record.snapshot.revision),
            session_id: session_id.to_string(),
            archive_path: record.snapshot.archive_path.clone(),
            status: ArchiveIndexStatusDto::Cancelled,
            discovered_entries: record.snapshot.discovered_entries,
            discovered_bytes: record.snapshot.discovered_bytes,
            final_entry_count: None,
            final_total_bytes: None,
            latest_failure: None,
        });
        record.sender.send_replace(cancelled);
        Ok(())
    }

    pub fn search(
        &self,
        request: ArchiveSearchRequest,
    ) -> Result<ArchiveChildrenPageDto, CommandErrorDto> {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let record = state
            .sessions
            .get(&request.session_id)
            .ok_or_else(|| archive_session_not_found(&request.session_id))?;
        if record.snapshot.status == ArchiveIndexStatusDto::Indexing {
            return Err(CommandErrorDto::operation_failed(
                "Archive search becomes available when indexing is complete.",
            ));
        }
        if let Some(expected) = request.expected_revision.as_deref()
            && expected != record.snapshot.revision
        {
            return Err(CommandErrorDto::invalid_request(
                "Archive search revision is stale; request it again.",
            ));
        }
        let index = record
            .index
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let normalized_query = request.query.trim().to_lowercase();
        let mut paths = index
            .entries
            .keys()
            .filter(|path| {
                normalized_query.is_empty() || path.to_lowercase().contains(&normalized_query)
            })
            .cloned()
            .collect::<Vec<_>>();
        let sort_key = request.sort_key.as_deref().unwrap_or("name");
        let ascending = request.sort_ascending.unwrap_or(true);
        paths.sort_by(|left, right| {
            compare_paths_by_sort(left, right, &index.entries, sort_key, ascending)
        });
        let cursor_scope = format!("?search={normalized_query}\0{sort_key}\0{ascending}");
        let limit = request
            .limit
            .unwrap_or(DEFAULT_ARCHIVE_PAGE_SIZE)
            .clamp(1, MAX_ARCHIVE_PAGE_SIZE);
        let offset = decode_cursor(
            request.cursor.as_deref(),
            &request.session_id,
            &cursor_scope,
            &record.snapshot.revision,
        )?;
        if offset > paths.len() {
            return Err(CommandErrorDto::invalid_request(
                "Archive search cursor is out of range.",
            ));
        }
        let end = offset.saturating_add(limit).min(paths.len());
        let entries = paths[offset..end]
            .iter()
            .filter_map(|path| index.entries.get(path).cloned())
            .collect();
        let next_cursor = (end < paths.len()).then(|| {
            encode_cursor(
                &request.session_id,
                &cursor_scope,
                &record.snapshot.revision,
                end,
            )
        });
        Ok(ArchiveChildrenPageDto {
            session_id: request.session_id,
            revision: record.snapshot.revision.clone(),
            parent_path: String::new(),
            entries,
            next_cursor,
            complete: end == paths.len(),
            child_count: paths.len(),
        })
    }

    fn publish_progress(&self, session_id: &str, statistics: ArchiveIndexStatistics) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some(record) = state.sessions.get_mut(session_id) else {
            return;
        };
        if record.cancelled.load(AtomicOrdering::Acquire) {
            return;
        }
        let revision = next_revision(&record.snapshot.revision);
        let snapshot = Arc::new(ArchiveIndexSnapshotDto {
            revision,
            session_id: session_id.to_string(),
            archive_path: record.snapshot.archive_path.clone(),
            status: ArchiveIndexStatusDto::Indexing,
            discovered_entries: statistics.entry_count,
            discovered_bytes: statistics.total_bytes,
            final_entry_count: None,
            final_total_bytes: None,
            latest_failure: None,
        });
        record.snapshot = snapshot.clone();
        record.sender.send_replace(snapshot);
    }

    fn finish(&self, session_id: &str, result: Result<ArchiveIndexStatistics, CommandErrorDto>) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some(record) = state.sessions.get_mut(session_id) else {
            return;
        };
        if record.cancelled.load(AtomicOrdering::Acquire) {
            return;
        }
        let snapshot = match result {
            Ok(statistics) => {
                let status = if statistics.entry_count == 0 {
                    ArchiveIndexStatusDto::Empty
                } else {
                    ArchiveIndexStatusDto::Ready
                };
                ArchiveIndexSnapshotDto {
                    revision: next_revision(&record.snapshot.revision),
                    session_id: session_id.to_string(),
                    archive_path: record.snapshot.archive_path.clone(),
                    status,
                    discovered_entries: statistics.entry_count,
                    discovered_bytes: statistics.total_bytes,
                    final_entry_count: Some(statistics.entry_count),
                    final_total_bytes: statistics.total_bytes,
                    latest_failure: None,
                }
            }
            Err(error) => ArchiveIndexSnapshotDto {
                revision: next_revision(&record.snapshot.revision),
                session_id: session_id.to_string(),
                archive_path: record.snapshot.archive_path.clone(),
                status: ArchiveIndexStatusDto::Failed,
                discovered_entries: 0,
                discovered_bytes: None,
                final_entry_count: None,
                final_total_bytes: None,
                latest_failure: Some(error),
            },
        };
        let snapshot = Arc::new(snapshot);
        record.snapshot = snapshot.clone();
        record.sender.send_replace(snapshot);
    }
}

#[cfg(test)]
struct ArchiveIndexBuild {
    index: ArchiveIndex,
    entry_count: usize,
    total_bytes: Option<u64>,
}

#[derive(Clone, Copy)]
struct ArchiveIndexStatistics {
    entry_count: usize,
    total_bytes: Option<u64>,
}

impl ArchiveIndex {
    fn new() -> Self {
        let mut children = HashMap::new();
        children.insert(String::new(), BTreeSet::new());
        Self {
            entries: HashMap::new(),
            children,
            entry_count: 0,
            total_bytes: 0,
            has_total: false,
            estimated_metadata_bytes: 0,
        }
    }

    fn insert(&mut self, browser_entry: BrowserEntry) -> Result<(), CommandErrorDto> {
        self.entry_count = self.entry_count.saturating_add(1);
        if self.entry_count > MAX_ARCHIVE_INDEX_ENTRIES {
            return Err(CommandErrorDto::operation_failed(format!(
                "Archive contains more than {MAX_ARCHIVE_INDEX_ENTRIES} entries, exceeding the browse limit. Extract All and Test remain available."
            )));
        }
        if let Some(size) = browser_entry.size {
            self.total_bytes = self.total_bytes.saturating_add(size);
            self.has_total = true;
        }
        let path = normalize_archive_path(&browser_entry.path);
        if path.is_empty() {
            return Ok(());
        }
        self.estimated_metadata_bytes = self
            .estimated_metadata_bytes
            .saturating_add(path.len())
            .saturating_add(128)
            .saturating_add(
                browser_entry
                    .metadata_diagnostics
                    .iter()
                    .map(String::len)
                    .sum::<usize>(),
            )
            .saturating_add(estimate_ancestor_growth(
                &path,
                browser_entry.kind,
                &self.entries,
                &self.children,
            ));
        if self.estimated_metadata_bytes > MAX_ARCHIVE_INDEX_METADATA_BYTES {
            return Err(CommandErrorDto::operation_failed(
                "Archive metadata exceeds the bounded browse index limit. Extract All and Test remain available.",
            ));
        }
        ensure_ancestors(
            &path,
            browser_entry.kind,
            &mut self.entries,
            &mut self.children,
        );
        self.entries
            .insert(path.clone(), browser_entry_to_dto(browser_entry, path));
        Ok(())
    }

    fn statistics(&self) -> ArchiveIndexStatistics {
        ArchiveIndexStatistics {
            entry_count: self.entry_count,
            total_bytes: self.has_total.then_some(self.total_bytes),
        }
    }
}

#[cfg(test)]
fn build_index(
    listing: zmanager_core::archive_browser::BrowserListing,
) -> Result<ArchiveIndexBuild, CommandErrorDto> {
    let mut index = ArchiveIndex::new();
    for browser_entry in listing.entries {
        index.insert(browser_entry)?;
    }
    let statistics = index.statistics();
    Ok(ArchiveIndexBuild {
        index,
        entry_count: statistics.entry_count,
        total_bytes: statistics.total_bytes,
    })
}

fn estimate_ancestor_growth(
    path: &str,
    kind: zmanager_core::archive_browser::BrowserEntryKind,
    entries: &HashMap<String, ArchiveEntryDto>,
    children: &HashMap<String, BTreeSet<String>>,
) -> usize {
    let segments = path.split('/').collect::<Vec<_>>();
    let directory_depth = if matches!(
        kind,
        zmanager_core::archive_browser::BrowserEntryKind::Directory
    ) {
        segments.len()
    } else {
        segments.len().saturating_sub(1)
    };
    let mut parent = String::new();
    let mut growth = 0_usize;
    for (index, segment) in segments.iter().enumerate() {
        let current = if parent.is_empty() {
            (*segment).to_string()
        } else {
            format!("{parent}/{segment}")
        };
        if !children
            .get(&parent)
            .is_some_and(|paths| paths.contains(&current))
        {
            growth = growth.saturating_add(current.len()).saturating_add(32);
        }
        if index < directory_depth && !entries.contains_key(&current) {
            growth = growth.saturating_add(current.len()).saturating_add(128);
        }
        parent = current;
    }
    growth
}

fn ensure_ancestors(
    path: &str,
    kind: zmanager_core::archive_browser::BrowserEntryKind,
    entries: &mut HashMap<String, ArchiveEntryDto>,
    children: &mut HashMap<String, BTreeSet<String>>,
) {
    let segments = path.split('/').collect::<Vec<_>>();
    let directory_depth = if matches!(
        kind,
        zmanager_core::archive_browser::BrowserEntryKind::Directory
    ) {
        segments.len()
    } else {
        segments.len().saturating_sub(1)
    };
    let mut parent = String::new();
    for (index, segment) in segments.iter().enumerate() {
        let current = if parent.is_empty() {
            (*segment).to_string()
        } else {
            format!("{parent}/{segment}")
        };
        children
            .entry(parent.clone())
            .or_default()
            .insert(current.clone());
        if index < directory_depth {
            entries
                .entry(current.clone())
                .or_insert_with(|| ArchiveEntryDto {
                    path: current.clone(),
                    kind: ArchiveEntryKindDto::Directory,
                    size: None,
                    compressed_size: None,
                    modified: None,
                    mode: None,
                    metadata_diagnostics: Vec::new(),
                    encrypted: None,
                    method: None,
                    crc: None,
                    comment: None,
                    created: None,
                    accessed: None,
                    solid: None,
                    link_target: None,
                    attributes: None,
                    uid: None,
                    gid: None,
                    owner: None,
                    group: None,
                });
        }
        parent = current;
    }
}

fn browser_entry_to_dto(entry: BrowserEntry, path: String) -> ArchiveEntryDto {
    ArchiveEntryDto {
        path,
        kind: crate::commands::map_browser_entry_kind(entry.kind),
        size: entry.size,
        compressed_size: entry.compressed_size,
        modified: entry.modified,
        mode: entry.mode,
        metadata_diagnostics: entry.metadata_diagnostics,
        encrypted: entry.encrypted,
        method: entry.method,
        crc: entry.crc.map(|c| format!("{:08X}", c)),
        comment: entry.comment,
        created: entry.created,
        accessed: entry.accessed,
        solid: entry.solid,
        link_target: entry.link_target,
        attributes: entry.attributes,
        uid: entry.uid,
        gid: entry.gid,
        owner: entry.owner,
        group: entry.group,
    }
}

#[cfg(test)]
fn compare_paths(left: &str, right: &str, entries: &HashMap<String, ArchiveEntryDto>) -> Ordering {
    compare_paths_by_sort(left, right, entries, "name", true)
}

fn compare_paths_by_sort(
    left: &str,
    right: &str,
    entries: &HashMap<String, ArchiveEntryDto>,
    sort_key: &str,
    ascending: bool,
) -> Ordering {
    let left_directory = entries
        .get(left)
        .is_some_and(|entry| entry.kind == ArchiveEntryKindDto::Directory);
    let right_directory = entries
        .get(right)
        .is_some_and(|entry| entry.kind == ArchiveEntryKindDto::Directory);
    let value_ordering = match (entries.get(left), entries.get(right)) {
        (Some(left_entry), Some(right_entry)) => match sort_key {
            "size" => compare_optional(&left_entry.size, &right_entry.size),
            "compressedSize" => {
                compare_optional(&left_entry.compressed_size, &right_entry.compressed_size)
            }
            "modified" => compare_optional(&left_entry.modified, &right_entry.modified),
            "mode" => compare_optional(&left_entry.mode, &right_entry.mode),
            "kind" => archive_kind_rank(left_entry.kind).cmp(&archive_kind_rank(right_entry.kind)),
            "ratio" => compression_ratio_order(left_entry, right_entry),
            _ => natural_cmp(archive_name(left), archive_name(right)),
        },
        _ => Ordering::Equal,
    };
    let value_ordering = if ascending {
        value_ordering
    } else {
        value_ordering.reverse()
    };
    right_directory
        .cmp(&left_directory)
        .then(value_ordering)
        .then_with(|| natural_cmp(archive_name(left), archive_name(right)))
        .then_with(|| left.as_bytes().cmp(right.as_bytes()))
}

fn archive_kind_rank(kind: ArchiveEntryKindDto) -> u8 {
    match kind {
        ArchiveEntryKindDto::Directory => 0,
        ArchiveEntryKindDto::File => 1,
        ArchiveEntryKindDto::Symlink => 2,
        ArchiveEntryKindDto::Hardlink => 3,
        ArchiveEntryKindDto::Special => 4,
    }
}

fn compression_ratio_order(left: &ArchiveEntryDto, right: &ArchiveEntryDto) -> Ordering {
    match (
        left.size.zip(left.compressed_size),
        right.size.zip(right.compressed_size),
    ) {
        (Some((left_size, left_packed)), Some((right_size, right_packed))) => left_packed
            .saturating_mul(right_size)
            .cmp(&right_packed.saturating_mul(left_size)),
        (None, None) => Ordering::Equal,
        (None, Some(_)) => Ordering::Greater,
        (Some(_), None) => Ordering::Less,
    }
}

fn compare_optional<T: Ord>(left: &Option<T>, right: &Option<T>) -> Ordering {
    match (left, right) {
        (Some(left), Some(right)) => left.cmp(right),
        (None, None) => Ordering::Equal,
        (None, Some(_)) => Ordering::Greater,
        (Some(_), None) => Ordering::Less,
    }
}

fn natural_cmp(left: &str, right: &str) -> Ordering {
    let left = left.to_lowercase();
    let right = right.to_lowercase();
    let mut left_chars = left.chars().peekable();
    let mut right_chars = right.chars().peekable();
    loop {
        match (left_chars.peek(), right_chars.peek()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(a), Some(b)) if a.is_ascii_digit() && b.is_ascii_digit() => {
                let left_number = take_digits(&mut left_chars);
                let right_number = take_digits(&mut right_chars);
                let ordering = left_number
                    .trim_start_matches('0')
                    .len()
                    .cmp(&right_number.trim_start_matches('0').len())
                    .then_with(|| {
                        left_number
                            .trim_start_matches('0')
                            .cmp(right_number.trim_start_matches('0'))
                    })
                    .then_with(|| left_number.len().cmp(&right_number.len()));
                if ordering != Ordering::Equal {
                    return ordering;
                }
            }
            _ => {
                let ordering = left_chars.next().cmp(&right_chars.next());
                if ordering != Ordering::Equal {
                    return ordering;
                }
            }
        }
    }
}

fn take_digits(chars: &mut std::iter::Peekable<std::str::Chars<'_>>) -> String {
    let mut output = String::new();
    while chars.peek().is_some_and(char::is_ascii_digit) {
        output.push(chars.next().expect("peeked digit should exist"));
    }
    output
}

fn archive_name(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

fn normalize_archive_path(path: &str) -> String {
    path.replace('\\', "/")
        .split('/')
        .filter(|segment| !segment.is_empty() && *segment != ".")
        .collect::<Vec<_>>()
        .join("/")
}

fn cursor_signature(session_id: &str, parent: &str, revision: &str) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    session_id.hash(&mut hasher);
    parent.hash(&mut hasher);
    revision.hash(&mut hasher);
    hasher.finish()
}

fn encode_cursor(session_id: &str, parent: &str, revision: &str, offset: usize) -> String {
    format!(
        "v1:{:016x}:{offset}",
        cursor_signature(session_id, parent, revision)
    )
}

fn decode_cursor(
    cursor: Option<&str>,
    session_id: &str,
    parent: &str,
    revision: &str,
) -> Result<usize, CommandErrorDto> {
    let Some(cursor) = cursor else {
        return Ok(0);
    };
    let mut parts = cursor.split(':');
    let valid = parts.next() == Some("v1")
        && parts.next()
            == Some(format!("{:016x}", cursor_signature(session_id, parent, revision)).as_str())
        && parts.clone().count() == 1;
    let offset = parts.next().and_then(|value| value.parse::<usize>().ok());
    if !valid || offset.is_none() {
        return Err(CommandErrorDto::invalid_request(
            "Archive page cursor is invalid or stale.",
        ));
    }
    Ok(offset.expect("validated cursor offset"))
}

fn archive_session_not_found(session_id: &str) -> CommandErrorDto {
    CommandErrorDto::not_found(
        format!("Archive session {session_id} was not found."),
        Some("Open the archive again.".to_string()),
    )
}

fn next_revision(revision: &str) -> String {
    revision
        .parse::<u64>()
        .unwrap_or_default()
        .saturating_add(1)
        .to_string()
}

impl Default for ArchiveIndexRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;
    use zmanager_core::archive_browser::{BrowserEntryKind, BrowserListing};

    fn entry(path: impl Into<String>, kind: BrowserEntryKind) -> BrowserEntry {
        BrowserEntry {
            path: path.into(),
            kind,
            size: Some(1),
            compressed_size: None,
            modified: None,
            mode: None,
            metadata_diagnostics: Vec::new(),
            encrypted: None,
            method: None,
            crc: None,
            comment: None,
            created: None,
            accessed: None,
            solid: None,
            link_target: None,
            attributes: None,
            uid: None,
            gid: None,
            owner: None,
            group: None,
        }
    }

    #[test]
    fn index_synthesizes_missing_folders_and_orders_names_naturally() {
        let build = build_index(BrowserListing {
            entries: vec![
                entry("folder/file10.txt", BrowserEntryKind::File),
                entry("folder/file2.txt", BrowserEntryKind::File),
                entry("root.txt", BrowserEntryKind::File),
            ],
        })
        .expect("index should build");

        assert_eq!(build.entry_count, 3);
        let mut root = build.index.children[""].iter().cloned().collect::<Vec<_>>();
        root.sort_by(|left, right| compare_paths(left, right, &build.index.entries));
        let mut folder = build.index.children["folder"]
            .iter()
            .cloned()
            .collect::<Vec<_>>();
        folder.sort_by(|left, right| compare_paths(left, right, &build.index.entries));
        assert_eq!(root, vec!["folder", "root.txt"]);
        assert_eq!(folder, vec!["folder/file2.txt", "folder/file10.txt"]);
        assert_eq!(
            build.index.entries["folder"].kind,
            ArchiveEntryKindDto::Directory
        );
    }

    #[test]
    fn pages_are_bounded_and_cursors_are_scoped_to_the_parent_and_revision() {
        let listing = BrowserListing {
            entries: (0..600)
                .map(|index| entry(format!("file{index}.txt"), BrowserEntryKind::File))
                .collect(),
        };
        let build = build_index(listing).expect("index should build");
        let registry = ArchiveIndexRegistry::new();
        let session_id = "archive-test".to_string();
        let snapshot = Arc::new(ArchiveIndexSnapshotDto {
            revision: "2".to_string(),
            session_id: session_id.clone(),
            archive_path: "test.zip".to_string(),
            status: ArchiveIndexStatusDto::Ready,
            discovered_entries: build.entry_count,
            discovered_bytes: build.total_bytes,
            final_entry_count: Some(build.entry_count),
            final_total_bytes: build.total_bytes,
            latest_failure: None,
        });
        let (sender, _) = watch::channel(snapshot.clone());
        registry
            .state
            .lock()
            .expect("registry lock")
            .sessions
            .insert(
                session_id.clone(),
                SessionRecord {
                    snapshot,
                    sender,
                    index: Arc::new(Mutex::new(build.index)),
                    cancelled: Arc::new(AtomicBool::new(false)),
                },
            );

        let first = registry
            .children(ArchiveChildrenRequest {
                session_id: session_id.clone(),
                parent_path: String::new(),
                cursor: None,
                limit: Some(10_000),
                expected_revision: Some("2".to_string()),
                sort_key: None,
                sort_ascending: None,
            })
            .expect("first page");
        assert_eq!(first.entries.len(), MAX_ARCHIVE_PAGE_SIZE);
        assert!(!first.complete);

        let stale = registry.children(ArchiveChildrenRequest {
            session_id,
            parent_path: "different".to_string(),
            cursor: first.next_cursor,
            limit: Some(1),
            expected_revision: Some("2".to_string()),
            sort_key: None,
            sort_ascending: None,
        });
        assert_eq!(
            stale.expect_err("cursor must be parent-scoped").code,
            "invalid_request"
        );

        let stale_revision = registry.children(ArchiveChildrenRequest {
            session_id: "archive-test".to_string(),
            parent_path: String::new(),
            cursor: None,
            limit: Some(1),
            expected_revision: Some("1".to_string()),
            sort_key: None,
            sort_ascending: None,
        });
        assert_eq!(
            stale_revision.expect_err("revision must be current").code,
            "invalid_request"
        );

        registry
            .close("archive-test")
            .expect("session should close");
        let after_close = registry.children(ArchiveChildrenRequest {
            session_id: "archive-test".to_string(),
            parent_path: String::new(),
            cursor: None,
            limit: Some(1),
            expected_revision: None,
            sort_key: None,
            sort_ascending: None,
        });
        assert_eq!(
            after_close.expect_err("closed session is gone").code,
            "not_found"
        );
    }

    #[test]
    fn retained_progress_uses_latest_value_without_a_notification_queue() {
        let registry = ArchiveIndexRegistry::new();
        let session_id = "archive-watch".to_string();
        let snapshot = Arc::new(ArchiveIndexSnapshotDto {
            revision: "1".to_string(),
            session_id: session_id.clone(),
            archive_path: "test.zip".to_string(),
            status: ArchiveIndexStatusDto::Indexing,
            discovered_entries: 0,
            discovered_bytes: None,
            final_entry_count: None,
            final_total_bytes: None,
            latest_failure: None,
        });
        let (sender, receiver) = watch::channel(snapshot.clone());
        registry
            .state
            .lock()
            .expect("registry lock")
            .sessions
            .insert(
                session_id.clone(),
                SessionRecord {
                    snapshot,
                    sender,
                    index: Arc::new(Mutex::new(ArchiveIndex::new())),
                    cancelled: Arc::new(AtomicBool::new(false)),
                },
            );

        for count in 1..=10 {
            registry.publish_progress(
                &session_id,
                ArchiveIndexStatistics {
                    entry_count: count,
                    total_bytes: Some(count as u64),
                },
            );
        }

        let latest = receiver.borrow().clone();
        assert_eq!(latest.revision, "11");
        assert_eq!(latest.discovered_entries, 10);
    }

    #[test]
    fn entry_and_metadata_admission_limits_fail_closed() {
        let mut entry_limited = ArchiveIndex::new();
        entry_limited.entry_count = MAX_ARCHIVE_INDEX_ENTRIES;
        let entry_error = entry_limited
            .insert(entry("overflow.txt", BrowserEntryKind::File))
            .expect_err("entry limit should reject the next entry");
        assert_eq!(entry_error.code, "operation_failed");

        let mut metadata_limited = ArchiveIndex::new();
        metadata_limited.estimated_metadata_bytes = MAX_ARCHIVE_INDEX_METADATA_BYTES - 1;
        let metadata_error = metadata_limited
            .insert(entry("metadata.txt", BrowserEntryKind::File))
            .expect_err("metadata limit should reject the next entry");
        assert_eq!(metadata_error.code, "operation_failed");
    }

    #[test]
    #[ignore = "performance characterization harness; run explicitly on release hardware"]
    fn characterize_one_hundred_thousand_entry_index() {
        let listing = BrowserListing {
            entries: (0..100_000)
                .map(|index| {
                    let path = if index < 50_000 {
                        format!("wide/file{index}.txt")
                    } else {
                        format!("deep/{}/{}/file{index}.txt", index % 100, index % 1_000)
                    };
                    entry(path, BrowserEntryKind::File)
                })
                .collect(),
        };
        let started = Instant::now();
        let build = build_index(listing).expect("large index should remain within limits");
        let elapsed = started.elapsed();

        assert_eq!(build.entry_count, 100_000);
        assert!(build.index.children["wide"].len() >= 50_000);
        eprintln!(
            "archive-index-baseline entries={} elapsed_ms={} metadata_limit_bytes={} page_limit={}",
            build.entry_count,
            elapsed.as_millis(),
            MAX_ARCHIVE_INDEX_METADATA_BYTES,
            MAX_ARCHIVE_PAGE_SIZE,
        );
    }
}
