use std::collections::HashMap;
use std::sync::OnceLock;

mod generated {
    include!("generated/native_capabilities.generated.rs");
}

#[cfg(test)]
use generated::{NATIVE_CAPABILITY_IDS, NATIVE_PACKAGE_KINDS};
pub use generated::{NativeCapabilityId, NativePackageKind};

const NATIVE_CAPABILITY_MANIFEST: &str =
    include_str!("generated/native_capabilities.generated.json");

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NativeCapabilityApplicability {
    Required,
    Optional,
    NotApplicable,
}

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum SourceExpectation {
    Implemented,
    OptionalUnavailable,
    NotApplicable,
}

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NativeCapabilitySourceState {
    Supported,
    Unavailable,
    Failed,
    NotApplicable,
}

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NativeCapabilityPackageState {
    Included,
    NotIncluded,
    NotInspected,
    Failed,
    NotApplicable,
}

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NativeCapabilityInstalledState {
    Registered,
    Unregistered,
    NotInspected,
    Failed,
    NotApplicable,
}

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NativeCapabilityUserEnabledState {
    Enabled,
    Disabled,
    NotInspected,
    Failed,
    NotApplicable,
}

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NativeCapabilityRuntimeState {
    Ready,
    Unavailable,
    NotInspected,
    Failed,
    NotApplicable,
}

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NativeCapabilityAvailability {
    Available,
    Unavailable,
    Failed,
    NotApplicable,
}

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NativeCapabilityFailureCategory {
    SourceMissing,
    PackageMissing,
    NotRegistered,
    UserDisabled,
    RuntimeUnavailable,
    PermissionDenied,
    InvalidConfiguration,
    ProbeFailed,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeCapabilityEvidence {
    pub source: Vec<String>,
    pub package: Vec<String>,
    pub installed: Vec<String>,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeCapabilitySnapshot {
    pub id: NativeCapabilityId,
    pub applicability: NativeCapabilityApplicability,
    pub first_class: bool,
    pub source_state: NativeCapabilitySourceState,
    pub package_state: NativeCapabilityPackageState,
    pub installed_state: NativeCapabilityInstalledState,
    pub user_enabled_state: NativeCapabilityUserEnabledState,
    pub runtime_state: NativeCapabilityRuntimeState,
    pub availability: NativeCapabilityAvailability,
    pub failure_category: Option<NativeCapabilityFailureCategory>,
    pub evidence: NativeCapabilityEvidence,
}

#[derive(Clone, Debug, Default)]
pub struct NativeCapabilityObservation {
    pub source_state: Option<NativeCapabilitySourceState>,
    pub package_state: Option<NativeCapabilityPackageState>,
    pub installed_state: Option<NativeCapabilityInstalledState>,
    pub user_enabled_state: Option<NativeCapabilityUserEnabledState>,
    pub runtime_state: Option<NativeCapabilityRuntimeState>,
    pub failure_category: Option<NativeCapabilityFailureCategory>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeCapabilityManifest {
    capabilities: Vec<NativeCapabilityDefinition>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeCapabilityDefinition {
    id: NativeCapabilityId,
    first_class: bool,
    applicability: HashMap<String, NativeCapabilityApplicability>,
    source_expectation: HashMap<String, SourceExpectation>,
    package_kinds: HashMap<String, Vec<NativePackageKind>>,
    installed_probe: HashMap<String, Option<String>>,
    installed_registration_required: HashMap<String, bool>,
    user_enabled_state: HashMap<String, bool>,
    runtime_probe_required: HashMap<String, bool>,
    evidence: NativeCapabilityEvidence,
}

fn manifest() -> &'static NativeCapabilityManifest {
    static MANIFEST: OnceLock<NativeCapabilityManifest> = OnceLock::new();
    MANIFEST.get_or_init(|| {
        serde_json::from_str(NATIVE_CAPABILITY_MANIFEST)
            .expect("generated native capability manifest must be valid")
    })
}

pub fn current_package_kind() -> NativePackageKind {
    match option_env!("ZMANAGER_PACKAGE_KIND").unwrap_or("development") {
        "development" => NativePackageKind::Development,
        "nsis" => NativePackageKind::Nsis,
        "appImage" => NativePackageKind::AppImage,
        "deb" => NativePackageKind::Deb,
        "rpm" => NativePackageKind::Rpm,
        "macosApp" => NativePackageKind::MacosApp,
        "macosDmg" => NativePackageKind::MacosDmg,
        package_kind => panic!("unknown ZMANAGER_PACKAGE_KIND: {package_kind}"),
    }
}

pub fn capability_snapshots(
    platform: &str,
    package_kind: NativePackageKind,
    observations: &HashMap<NativeCapabilityId, NativeCapabilityObservation>,
) -> Vec<NativeCapabilitySnapshot> {
    manifest()
        .capabilities
        .iter()
        .map(|definition| snapshot_for_definition(definition, platform, package_kind, observations))
        .collect()
}

#[cfg(test)]
pub fn baseline_capability_snapshots(
    platform: &str,
    package_kind: NativePackageKind,
) -> Vec<NativeCapabilitySnapshot> {
    capability_snapshots(platform, package_kind, &HashMap::new())
}

fn snapshot_for_definition(
    definition: &NativeCapabilityDefinition,
    platform: &str,
    package_kind: NativePackageKind,
    observations: &HashMap<NativeCapabilityId, NativeCapabilityObservation>,
) -> NativeCapabilitySnapshot {
    let applicability = *required_platform_value(&definition.applicability, platform);
    if applicability == NativeCapabilityApplicability::NotApplicable {
        return NativeCapabilitySnapshot {
            id: definition.id,
            applicability,
            first_class: definition.first_class,
            source_state: NativeCapabilitySourceState::NotApplicable,
            package_state: NativeCapabilityPackageState::NotApplicable,
            installed_state: NativeCapabilityInstalledState::NotApplicable,
            user_enabled_state: NativeCapabilityUserEnabledState::NotApplicable,
            runtime_state: NativeCapabilityRuntimeState::NotApplicable,
            availability: NativeCapabilityAvailability::NotApplicable,
            failure_category: None,
            evidence: definition.evidence.clone(),
        };
    }

    let expected_source = required_platform_value(&definition.source_expectation, platform);
    let expected_packages = required_platform_value(&definition.package_kinds, platform);
    let installed_probe = required_platform_value(&definition.installed_probe, platform);
    let installed_registration_required =
        *required_platform_value(&definition.installed_registration_required, platform);
    let user_enabled_state_required =
        *required_platform_value(&definition.user_enabled_state, platform);
    let runtime_probe_required =
        *required_platform_value(&definition.runtime_probe_required, platform);
    let observation = observations
        .get(&definition.id)
        .cloned()
        .unwrap_or_default();

    let source_state = observation.source_state.unwrap_or(match expected_source {
        SourceExpectation::Implemented => NativeCapabilitySourceState::Supported,
        SourceExpectation::OptionalUnavailable => NativeCapabilitySourceState::Unavailable,
        SourceExpectation::NotApplicable => NativeCapabilitySourceState::NotApplicable,
    });
    let package_state = observation.package_state.unwrap_or_else(|| {
        if expected_packages.is_empty() {
            NativeCapabilityPackageState::NotApplicable
        } else if expected_packages.contains(&package_kind) {
            NativeCapabilityPackageState::NotInspected
        } else {
            NativeCapabilityPackageState::NotIncluded
        }
    });
    let installed_state = observation
        .installed_state
        .unwrap_or(if installed_probe.is_some() {
            NativeCapabilityInstalledState::NotInspected
        } else {
            NativeCapabilityInstalledState::NotApplicable
        });
    let user_enabled_state =
        observation
            .user_enabled_state
            .unwrap_or(if user_enabled_state_required {
                NativeCapabilityUserEnabledState::NotInspected
            } else {
                NativeCapabilityUserEnabledState::NotApplicable
            });
    let runtime_state = observation.runtime_state.unwrap_or(
        if source_state == NativeCapabilitySourceState::Unavailable {
            NativeCapabilityRuntimeState::Unavailable
        } else if runtime_probe_required {
            NativeCapabilityRuntimeState::NotInspected
        } else {
            NativeCapabilityRuntimeState::Ready
        },
    );

    let availability = availability(
        source_state,
        package_state,
        installed_state,
        user_enabled_state,
        runtime_state,
        installed_registration_required,
        user_enabled_state_required,
        runtime_probe_required,
    );
    let failure_category = if matches!(
        availability,
        NativeCapabilityAvailability::Available | NativeCapabilityAvailability::NotApplicable
    ) {
        None
    } else {
        observation.failure_category.or_else(|| {
            Some(infer_failure_category(
                source_state,
                package_state,
                installed_state,
                user_enabled_state,
                runtime_state,
            ))
        })
    };

    NativeCapabilitySnapshot {
        id: definition.id,
        applicability,
        first_class: definition.first_class,
        source_state,
        package_state,
        installed_state,
        user_enabled_state,
        runtime_state,
        availability,
        failure_category,
        evidence: definition.evidence.clone(),
    }
}

fn availability(
    source: NativeCapabilitySourceState,
    package: NativeCapabilityPackageState,
    installed: NativeCapabilityInstalledState,
    user: NativeCapabilityUserEnabledState,
    runtime: NativeCapabilityRuntimeState,
    installed_required: bool,
    user_required: bool,
    runtime_required: bool,
) -> NativeCapabilityAvailability {
    if source == NativeCapabilitySourceState::NotApplicable {
        return NativeCapabilityAvailability::NotApplicable;
    }
    if source == NativeCapabilitySourceState::Failed
        || package == NativeCapabilityPackageState::Failed
        || installed == NativeCapabilityInstalledState::Failed
        || user == NativeCapabilityUserEnabledState::Failed
        || runtime == NativeCapabilityRuntimeState::Failed
    {
        return NativeCapabilityAvailability::Failed;
    }
    if source != NativeCapabilitySourceState::Supported
        || package == NativeCapabilityPackageState::NotIncluded
        || (installed_required && installed != NativeCapabilityInstalledState::Registered)
        || (user_required && user != NativeCapabilityUserEnabledState::Enabled)
        || (runtime_required && runtime != NativeCapabilityRuntimeState::Ready)
    {
        return NativeCapabilityAvailability::Unavailable;
    }
    NativeCapabilityAvailability::Available
}

fn infer_failure_category(
    source: NativeCapabilitySourceState,
    package: NativeCapabilityPackageState,
    installed: NativeCapabilityInstalledState,
    user: NativeCapabilityUserEnabledState,
    runtime: NativeCapabilityRuntimeState,
) -> NativeCapabilityFailureCategory {
    if source != NativeCapabilitySourceState::Supported {
        NativeCapabilityFailureCategory::SourceMissing
    } else if package == NativeCapabilityPackageState::NotIncluded {
        NativeCapabilityFailureCategory::PackageMissing
    } else if installed == NativeCapabilityInstalledState::NotInspected
        || installed == NativeCapabilityInstalledState::Unregistered
    {
        NativeCapabilityFailureCategory::NotRegistered
    } else if user == NativeCapabilityUserEnabledState::NotInspected
        || user == NativeCapabilityUserEnabledState::Disabled
    {
        NativeCapabilityFailureCategory::UserDisabled
    } else if runtime != NativeCapabilityRuntimeState::Ready {
        NativeCapabilityFailureCategory::RuntimeUnavailable
    } else {
        NativeCapabilityFailureCategory::ProbeFailed
    }
}

fn required_platform_value<'a, T>(values: &'a HashMap<String, T>, platform: &str) -> &'a T {
    values
        .get(platform)
        .unwrap_or_else(|| panic!("native capability catalog has no {platform} declaration"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_catalog_and_rust_snapshots_match_the_shared_fixture() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../fixtures/contracts/native-capabilities.conformance.json"
        ))
        .expect("native capability fixture should parse");

        for platform in ["windows", "linux", "macos"] {
            let actual = serde_json::to_value(baseline_capability_snapshots(
                platform,
                NativePackageKind::Development,
            ))
            .expect("snapshots should serialize");
            assert_eq!(actual, fixture["platforms"][platform]);
        }
    }

    #[test]
    fn available_first_class_capability_fails_closed_when_a_required_layer_is_missing() {
        let mut observations = HashMap::new();
        observations.insert(
            NativeCapabilityId::FinderTokenTransport,
            NativeCapabilityObservation {
                package_state: Some(NativeCapabilityPackageState::Included),
                installed_state: Some(NativeCapabilityInstalledState::Registered),
                user_enabled_state: Some(NativeCapabilityUserEnabledState::Enabled),
                runtime_state: Some(NativeCapabilityRuntimeState::Ready),
                ..NativeCapabilityObservation::default()
            },
        );
        let snapshots = capability_snapshots("macos", NativePackageKind::MacosApp, &observations);
        let available = snapshots
            .iter()
            .find(|snapshot| snapshot.id == NativeCapabilityId::FinderTokenTransport)
            .expect("Finder capability should exist");
        assert_eq!(
            available.availability,
            NativeCapabilityAvailability::Available
        );

        observations
            .get_mut(&NativeCapabilityId::FinderTokenTransport)
            .expect("observation should exist")
            .runtime_state = Some(NativeCapabilityRuntimeState::Unavailable);
        let snapshots = capability_snapshots("macos", NativePackageKind::MacosApp, &observations);
        let unavailable = snapshots
            .iter()
            .find(|snapshot| snapshot.id == NativeCapabilityId::FinderTokenTransport)
            .expect("Finder capability should exist");
        assert_eq!(
            unavailable.availability,
            NativeCapabilityAvailability::Unavailable
        );
    }

    #[test]
    fn failed_probe_and_not_applicable_are_distinct_normalized_outcomes() {
        let mut observations = HashMap::new();
        observations.insert(
            NativeCapabilityId::NativeFileDrag,
            NativeCapabilityObservation {
                runtime_state: Some(NativeCapabilityRuntimeState::Failed),
                failure_category: Some(NativeCapabilityFailureCategory::ProbeFailed),
                ..NativeCapabilityObservation::default()
            },
        );
        let snapshots =
            capability_snapshots("macos", NativePackageKind::Development, &observations);
        let failed = snapshots
            .iter()
            .find(|snapshot| snapshot.id == NativeCapabilityId::NativeFileDrag)
            .expect("native drag capability should exist");
        assert_eq!(failed.availability, NativeCapabilityAvailability::Failed);
        assert_eq!(
            failed.failure_category,
            Some(NativeCapabilityFailureCategory::ProbeFailed)
        );

        let not_applicable = snapshots
            .iter()
            .find(|snapshot| snapshot.id == NativeCapabilityId::FinderTokenTransport)
            .expect("Finder transport capability should exist");
        assert_eq!(
            not_applicable.availability,
            NativeCapabilityAvailability::Unavailable
        );
        let windows = baseline_capability_snapshots("windows", NativePackageKind::Development);
        let finder_on_windows = windows
            .iter()
            .find(|snapshot| snapshot.id == NativeCapabilityId::FinderTokenTransport)
            .expect("Finder transport capability should exist");
        assert_eq!(
            finder_on_windows.availability,
            NativeCapabilityAvailability::NotApplicable
        );
    }

    #[test]
    fn every_generated_identifier_has_one_catalog_definition() {
        assert_eq!(manifest().capabilities.len(), NATIVE_CAPABILITY_IDS.len());
        for id in NATIVE_CAPABILITY_IDS {
            assert_eq!(
                manifest()
                    .capabilities
                    .iter()
                    .filter(|capability| capability.id == *id)
                    .count(),
                1
            );
        }
        assert_eq!(NATIVE_PACKAGE_KINDS.len(), 7);
    }
}
