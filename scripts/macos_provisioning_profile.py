#!/usr/bin/env python3
"""Select a valid macOS development provisioning profile for one bundle."""

from __future__ import annotations

import argparse
import datetime
import hashlib
import os
import plistlib
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class ProfileRequirements:
    bundle_identifier: str
    team_identifier: str
    app_group_identifier: str
    signing_identity_sha1: str


def decode_profile(path: Path) -> dict:
    encoded = path.read_bytes()
    try:
        return plistlib.loads(encoded)
    except plistlib.InvalidFileException:
        result = subprocess.run(
            ["security", "cms", "-D", "-i", str(path)],
            check=False,
            capture_output=True,
        )
        if result.returncode != 0:
            raise ValueError(f"unable to decode provisioning profile: {path}")
        try:
            return plistlib.loads(result.stdout)
        except plistlib.InvalidFileException as error:
            raise ValueError(f"invalid provisioning profile: {path}") from error


def profile_errors(
    profile: dict,
    requirements: ProfileRequirements,
    now: datetime.datetime,
) -> list[str]:
    errors: list[str] = []
    expiration = profile.get("ExpirationDate")
    if not isinstance(expiration, datetime.datetime):
        errors.append("missing expiration")
    else:
        if expiration.tzinfo is None:
            expiration = expiration.replace(tzinfo=datetime.timezone.utc)
        if expiration <= now:
            errors.append("expired")

    if "OSX" not in profile.get("Platform", []):
        errors.append("not a macOS profile")
    if requirements.team_identifier not in profile.get("TeamIdentifier", []):
        errors.append("team mismatch")

    entitlements = profile.get("Entitlements", {})
    application_identifier = (
        entitlements.get("com.apple.application-identifier")
        or entitlements.get("application-identifier")
    )
    expected_application_identifier = (
        f"{requirements.team_identifier}.{requirements.bundle_identifier}"
    )
    if application_identifier != expected_application_identifier:
        errors.append("application identifier mismatch")
    if requirements.app_group_identifier not in entitlements.get(
        "com.apple.security.application-groups", []
    ):
        errors.append("App Group mismatch")

    expected_certificate = requirements.signing_identity_sha1.upper()
    profile_certificates = {
        hashlib.sha1(certificate).hexdigest().upper()
        for certificate in profile.get("DeveloperCertificates", [])
    }
    if expected_certificate not in profile_certificates:
        errors.append("signing certificate mismatch")
    if not profile.get("ProvisionedDevices"):
        errors.append("profile has no registered Mac")
    return errors


def select_profile(
    candidates: Iterable[Path],
    requirements: ProfileRequirements,
    now: datetime.datetime | None = None,
) -> Path | None:
    now = now or datetime.datetime.now(datetime.timezone.utc)
    valid: list[tuple[datetime.datetime, Path]] = []
    for candidate in candidates:
        try:
            profile = decode_profile(candidate)
        except (OSError, ValueError):
            continue
        if profile_errors(profile, requirements, now):
            continue
        expiration = profile["ExpirationDate"]
        if expiration.tzinfo is None:
            expiration = expiration.replace(tzinfo=datetime.timezone.utc)
        valid.append((expiration, candidate))
    if not valid:
        return None
    return max(valid, key=lambda item: (item[0], str(item[1])))[1]


def default_profile_directories() -> list[Path]:
    home = Path.home()
    return [
        home / "Library/Developer/Xcode/UserData/Provisioning Profiles",
        home / "Library/MobileDevice/Provisioning Profiles",
    ]


def profile_candidates(directories: Iterable[Path]) -> list[Path]:
    candidates: list[Path] = []
    for directory in directories:
        if not directory.is_dir():
            continue
        candidates.extend(
            path
            for path in directory.iterdir()
            if path.is_file()
            and path.suffix in {".provisionprofile", ".mobileprovision", ".plist"}
        )
    return candidates


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle-id", required=True)
    parser.add_argument("--team-id", required=True)
    parser.add_argument("--app-group", required=True)
    parser.add_argument("--identity-sha1", required=True)
    parser.add_argument(
        "--profile-dir",
        action="append",
        type=Path,
        help="Search only this profile directory; may be repeated.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    requirements = ProfileRequirements(
        bundle_identifier=args.bundle_id,
        team_identifier=args.team_id,
        app_group_identifier=args.app_group,
        signing_identity_sha1=args.identity_sha1.replace(":", ""),
    )
    directories = args.profile_dir or default_profile_directories()
    selected = select_profile(profile_candidates(directories), requirements)
    if selected is None:
        return 1
    print(os.fspath(selected))
    return 0


if __name__ == "__main__":
    sys.exit(main())
