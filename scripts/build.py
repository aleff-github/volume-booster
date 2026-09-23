#!/usr/bin/env python3
"""Build distributable Chrome and Firefox packages using only the Python stdlib."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
COMMON = ROOT / "common"
ICONS = ROOT / "icons"
DIST = ROOT / "dist"
TARGETS = ("chrome", "firefox")
SHARED_FILES = ("content.js", "popup.html", "popup.js")


def load_manifest(target: str) -> dict:
    manifest_path = ROOT / target / "manifest.json"
    with manifest_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate() -> tuple[str, str]:
    manifests = {target: load_manifest(target) for target in TARGETS}

    versions = {manifest["version"] for manifest in manifests.values()}
    if len(versions) != 1:
        raise ValueError("Chrome and Firefox manifest versions must match.")

    names = {manifest["name"] for manifest in manifests.values()}
    if len(names) != 1:
        raise ValueError("Chrome and Firefox manifest names must match.")

    for filename in SHARED_FILES:
        if not (COMMON / filename).is_file():
            raise FileNotFoundError(f"Missing shared file: common/{filename}")

    required_icons = ("icon16.png", "icon32.png", "icon48.png", "icon128.png")
    for filename in required_icons:
        if not (ICONS / filename).is_file():
            raise FileNotFoundError(f"Missing icon: icons/{filename}")

    firefox_gecko = manifests["firefox"].get("browser_specific_settings", {}).get("gecko", {})
    if not firefox_gecko.get("id"):
        raise ValueError("Firefox manifest must define browser_specific_settings.gecko.id.")

    data_permissions = firefox_gecko.get("data_collection_permissions", {}).get("required", [])
    if "none" not in data_permissions:
        raise ValueError("Firefox manifest must declare required data_collection_permissions.")

    return manifests["chrome"]["version"], manifests["chrome"]["name"]


def copy_target(target: str) -> Path:
    target_dir = DIST / target
    target_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(ROOT / target / "manifest.json", target_dir / "manifest.json")

    for filename in SHARED_FILES:
        shutil.copy2(COMMON / filename, target_dir / filename)

    shutil.copytree(ICONS, target_dir / "icons", dirs_exist_ok=True)
    return target_dir


def create_archive(target: str, target_dir: Path, version: str) -> Path:
    archive = DIST / f"volume-booster-{target}-{version}.zip"

    with ZipFile(archive, "w", ZIP_DEFLATED) as package:
        for path in sorted(target_dir.rglob("*")):
            if path.is_file():
                package.write(path, path.relative_to(target_dir))

    return archive


def main() -> None:
    version, _ = validate()

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    for target in TARGETS:
        target_dir = copy_target(target)
        archive = create_archive(target, target_dir, version)
        print(f"Built {target}: {target_dir.relative_to(ROOT)}")
        print(f"Package: {archive.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
