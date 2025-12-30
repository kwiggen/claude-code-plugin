#!/usr/bin/env python3
"""Release reports script for weekly release cycle insights.

Generates two reports:
- preview: What's shipping (run Sunday after release train)
- retro: What happened (run Tuesday after prod stabilizes)
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from typing import TypedDict
from zoneinfo import ZoneInfo

# Import shared helpers from gh_stats
_script_dir = os.path.dirname(os.path.abspath(__file__))
_gh_stats_dir = os.path.join(
    _script_dir, "..", "..", "github-insights", "scripts"
)
sys.path.insert(0, _gh_stats_dir)
from gh_stats import (  # noqa: E402
    get_repo_info,
    get_pr_stats,
    fetch_pr_reviews,
    fetch_pr_comments,
    parse_datetime,
    PRStatsResponse,
    UserDict,
)


# Module-level flag to avoid repeated git fetches
_remote_fetched = False


# -----------------------------------------------------------------------------
# TypedDicts for API Responses
# -----------------------------------------------------------------------------


class BranchRef(TypedDict):
    """GitHub branch reference."""

    ref: str


class AreaStats(TypedDict):
    """Stats for a codebase area (FE, BE, CT, other)."""

    additions: int
    deletions: int


class TrendEntry(TypedDict):
    """Entry in release trend data."""

    date: str
    pr_count: int
    staging_hf: int
    release_hf: int
    outcome: str


class _ReleasePRRequired(TypedDict):
    """Required fields for release PR data."""

    number: int
    title: str
    user: UserDict
    created_at: str
    merged_at: str


class ReleasePR(_ReleasePRRequired, total=False):
    """PR data used in release reports with branch refs."""

    body: str | None
    base: BranchRef
    head: BranchRef
    merge_commit_sha: str | None
    stats: PRStatsResponse
    area_stats: dict[str, AreaStats]
    backmerged: bool
    # Quick approval detection fields
    review_time_min: float
    is_large: bool
    comment_count: int


# -----------------------------------------------------------------------------
# PR Classification Functions
# -----------------------------------------------------------------------------

# Release train branch patterns (→ staging)
RELEASE_TRAIN_PATTERNS = [
    r"^staging-\d{2}-\d{2}-\d{2}$",   # staging-12-21-25
    r"^release-\d{2}-\d{2}-\d{2}$",   # release-12-14-25
    r"^release-to-staging$",
]

# Promotion branch patterns (→ release)
PROMOTION_PATTERNS = [
    r"^release-\d{2}-\d{2}-\d{2}$",   # release-12-22-25
    r"^staging$",                       # direct staging→release (legacy)
]


def is_release_train(pr: ReleasePR) -> bool:
    """Check if PR is a release train (dated branch → staging)."""
    base = pr.get("base")
    if base is None or base.get("ref") != "staging":
        return False
    head = pr.get("head")
    head_ref = head.get("ref", "") if head else ""
    return any(re.match(p, head_ref) for p in RELEASE_TRAIN_PATTERNS)


def is_promotion(pr: ReleasePR) -> bool:
    """Check if PR is a promotion (dated branch → release)."""
    base = pr.get("base")
    if base is None or base.get("ref") != "release":
        return False
    head = pr.get("head")
    head_ref = head.get("ref", "") if head else ""
    return any(re.match(p, head_ref) for p in PROMOTION_PATTERNS)


def is_backmerge(pr: ReleasePR) -> bool:
    """Check if PR is a backmerge (staging → develop)."""
    base = pr.get("base")
    head = pr.get("head")
    base_ref = base.get("ref", "") if base else ""
    head_ref = head.get("ref", "") if head else ""
    return base_ref == "develop" and head_ref == "staging"


def is_hotfix_to_staging(pr: ReleasePR) -> bool:
    """Check if PR is a hotfix to staging (not a release train)."""
    base = pr.get("base")
    if base is None or base.get("ref") != "staging":
        return False
    if is_release_train(pr):
        return False
    # Exclude release→staging backmerges
    head = pr.get("head")
    if head is not None and head.get("ref") == "release":
        return False
    return True


def is_hotfix_to_release(pr: ReleasePR) -> bool:
    """Check if PR is a hotfix to release (not a promotion)."""
    base = pr.get("base")
    if base is None or base.get("ref") != "release":
        return False
    if is_promotion(pr):
        return False
    return True


# -----------------------------------------------------------------------------
# Data Fetching Functions
# -----------------------------------------------------------------------------


def fetch_prs_by_base(
    owner: str,
    repo: str,
    base: str,
    since: datetime,
    until: datetime | None = None,
) -> list[ReleasePR]:
    """Fetch merged PRs to a specific base branch within a date range."""
    prs: list[ReleasePR] = []
    page = 1
    per_page = 100

    while True:
        result = subprocess.run(
            [
                "gh", "api", f"repos/{owner}/{repo}/pulls",
                "-X", "GET",
                "-f", "state=closed",
                "-f", f"base={base}",
                "-f", f"per_page={per_page}",
                "-f", f"page={page}",
            ],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            print(f"Error fetching PRs: {result.stderr}", file=sys.stderr)
            return prs

        page_prs = json.loads(result.stdout)
        if not page_prs:
            break

        for pr in page_prs:
            if not pr.get("merged_at"):
                continue

            merged_at = parse_datetime(pr["merged_at"])

            if merged_at < since:
                return prs

            if until and merged_at > until:
                continue

            prs.append(pr)

        page += 1
        if len(page_prs) < per_page:
            break

    return prs


def find_release_trains(
    owner: str, repo: str, limit: int = 5, days: int = 60
) -> list[ReleasePR]:
    """Find the most recent release train PRs (dated branch → staging)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    staging_prs = fetch_prs_by_base(owner, repo, "staging", since)
    trains = [pr for pr in staging_prs if is_release_train(pr)]
    return trains[:limit]


def find_last_promotion(
    owner: str, repo: str, days: int = 30
) -> ReleasePR | None:
    """Find the most recent promotion PR (staging → release)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    release_prs = fetch_prs_by_base(owner, repo, "release", since)
    promotions = [pr for pr in release_prs if is_promotion(pr)]
    return promotions[0] if promotions else None


def get_backmerges_since(
    owner: str, repo: str, since: datetime
) -> list[ReleasePR]:
    """Get backmerge PRs (staging → develop) since a date."""
    develop_prs = fetch_prs_by_base(owner, repo, "develop", since)
    return [pr for pr in develop_prs if is_backmerge(pr)]


def ensure_remote_updated() -> bool:
    """Fetch origin/develop to ensure we have the latest state.

    Only fetches once per script execution to avoid excessive network calls.

    Returns:
        True if fetch succeeded or was already done, False on error
    """
    global _remote_fetched

    if _remote_fetched:
        return True

    try:
        result = subprocess.run(
            ["git", "fetch", "origin", "develop"],
            capture_output=True,
            text=True,
            timeout=30,  # Network operation, allow more time
        )
        _remote_fetched = True
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return False


def is_commit_reachable_from_develop(commit_sha: str) -> bool:
    """Check if a commit is reachable from origin/develop using git.

    Uses 'git merge-base --is-ancestor' which returns:
    - Exit code 0: commit IS an ancestor (reachable)
    - Exit code 1: commit is NOT an ancestor
    - Exit code 128+: error (invalid SHA, not a repo, etc.)

    Args:
        commit_sha: The commit SHA to check

    Returns:
        True if commit is reachable from origin/develop, False otherwise
    """
    if not commit_sha:
        return False

    try:
        result = subprocess.run(
            ["git", "merge-base", "--is-ancestor", commit_sha, "origin/develop"],
            capture_output=True,
            text=True,
            timeout=10,  # Avoid hanging on large repos
        )
        # Exit code 0 = is ancestor (reachable), 1 = not ancestor, other = error
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        # If git is unavailable or times out, return False to fall back
        return False


def get_backmerged_commits(hotfixes: list[ReleasePR]) -> set[str]:
    """Get set of merge commit SHAs that are reachable from origin/develop.

    More efficient than individual checks when processing many hotfixes,
    as it ensures remote is fetched only once.

    Args:
        hotfixes: List of hotfix PR dictionaries with 'merge_commit_sha' field

    Returns:
        Set of commit SHAs that are reachable from origin/develop
    """
    # Ensure we have the latest remote state
    ensure_remote_updated()

    reachable: set[str] = set()

    for hf in hotfixes:
        # GitHub REST API returns merge_commit_sha as a top-level string field
        merge_sha = hf.get("merge_commit_sha")

        if merge_sha and is_commit_reachable_from_develop(merge_sha):
            reachable.add(merge_sha)

    return reachable


def has_backmerge_after(
    hotfix: ReleasePR,
    backmerges: list[ReleasePR],
    reachable_commits: set[str] | None = None,
) -> bool:
    """Check if a hotfix has been backmerged to develop.

    Uses two detection methods in order of reliability:
    1. Git-based: Check if merge commit is reachable from origin/develop
    2. Text-based: Look for PR references in backmerge descriptions (fallback)

    Args:
        hotfix: The hotfix PR dictionary (must include merge_commit_sha field)
        backmerges: List of backmerge PRs (staging -> develop)
        reachable_commits: Optional pre-computed set of commits reachable from
            develop. If None, will check individually (less efficient).

    Returns:
        True if hotfix has been backmerged, False otherwise
    """
    # Method 1: Git-based detection (most reliable)
    # GitHub REST API returns merge_commit_sha as a top-level string field
    merge_sha = hotfix.get("merge_commit_sha")

    if merge_sha:
        if reachable_commits is not None:
            # Use pre-computed set (efficient for batch operations)
            if merge_sha in reachable_commits:
                return True
        else:
            # Individual check (fallback if set not provided)
            ensure_remote_updated()
            if is_commit_reachable_from_develop(merge_sha):
                return True

    # Method 2: Text-based detection (fallback for edge cases)
    # This catches cases where:
    # - merge commit SHA is missing from API response
    # - Git is unavailable in the execution environment
    # - The commit was squashed/rebased with a different SHA
    hotfix_merged = parse_datetime(hotfix["merged_at"])
    hotfix_title = hotfix.get("title", "").lower()
    hotfix_number = hotfix["number"]

    for bm in backmerges:
        bm_merged = parse_datetime(bm["merged_at"])
        if bm_merged <= hotfix_merged:
            continue

        bm_title = bm.get("title", "").lower()
        body = bm.get("body")
        bm_body = body.lower() if body else ""

        if (
            str(hotfix_number) in bm_title
            or str(hotfix_number) in bm_body
            or hotfix_title in bm_title
        ):
            return True

    return False


def get_pr_area_stats(owner: str, repo: str, pr_number: int) -> dict[str, AreaStats]:
    """Get lines added/removed per codebase area.

    Returns dict with keys 'FE', 'BE', 'CT', 'other', each containing
    {'additions': N, 'deletions': M}.
    """
    result = subprocess.run(
        ["gh", "api", f"repos/{owner}/{repo}/pulls/{pr_number}/files",
         "--paginate"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        return {}

    files = json.loads(result.stdout)
    area_stats: dict[str, AreaStats] = {
        "FE": {"additions": 0, "deletions": 0},
        "BE": {"additions": 0, "deletions": 0},
        "CT": {"additions": 0, "deletions": 0},
        "other": {"additions": 0, "deletions": 0},
    }

    for file in files:
        filename = file.get("filename", "")
        additions = file.get("additions", 0)
        deletions = file.get("deletions", 0)

        if filename.startswith("frontend/"):
            area = "FE"
        elif filename.startswith("backend/"):
            area = "BE"
        elif filename.startswith("content-tool/"):
            area = "CT"
        else:
            area = "other"

        area_stats[area]["additions"] += additions
        area_stats[area]["deletions"] += deletions

    return area_stats


def pr_link(owner: str, repo: str, pr_number: int) -> str:
    """Return GitHub PR URL."""
    return f"https://github.com/{owner}/{repo}/pull/{pr_number}"


def format_area_breakdown(area_stats: dict[str, AreaStats]) -> str:
    """Format area stats as compact string, only showing non-zero areas."""
    parts = []
    for area in ["FE", "BE", "CT", "other"]:
        stats = area_stats.get(area)
        if stats is None:
            continue
        add = stats.get("additions", 0)
        delete = stats.get("deletions", 0)
        if add > 0 or delete > 0:
            parts.append(f"{area}:+{add}/-{delete}")
    return ", ".join(parts) if parts else "—"


def find_quick_approvals(
    owner: str, repo: str, prs: list[ReleasePR]
) -> list[ReleasePR]:
    """Find PRs with quick approvals (<5 min), large or no comments."""
    quick_approvals = []

    for pr in prs:
        stats = pr.get("stats", {})
        total_lines = stats.get("additions", 0) + stats.get("deletions", 0)
        is_large = total_lines >= 500

        reviews = fetch_pr_reviews(owner, repo, pr["number"])
        comments = fetch_pr_comments(owner, repo, pr["number"])

        created = parse_datetime(pr["created_at"])

        for review in reviews:
            if review.get("state") != "APPROVED":
                continue

            submitted_at = review.get("submitted_at")
            if not submitted_at:
                continue

            submitted = parse_datetime(submitted_at)
            review_time = (submitted - created).total_seconds() / 60

            if review_time < 5:
                if is_large or len(comments) == 0:
                    pr["review_time_min"] = review_time
                    pr["is_large"] = is_large
                    pr["comment_count"] = len(comments)
                    quick_approvals.append(pr)
                    break

    return quick_approvals


# -----------------------------------------------------------------------------
# Preview Report
# -----------------------------------------------------------------------------


def cmd_preview(owner: str, repo: str, days: int = 30) -> None:
    """Generate release preview report."""
    trains = find_release_trains(owner, repo, limit=2, days=days)

    if not trains:
        print(f"No release train found in last {days} days.")
        print("Run this command after a release train is merged.")
        return

    current_train = trains[0]
    current_date = parse_datetime(current_train["merged_at"])

    if len(trains) > 1:
        previous_train = trains[1]
        since_date = parse_datetime(previous_train["merged_at"])
    else:
        since_date = current_date - timedelta(days=7)

    all_prs = fetch_prs_by_base(
        owner, repo, "develop", since_date, current_date
    )
    feature_prs: list[ReleasePR] = []
    for pr in all_prs:
        head = pr.get("head")
        head_ref = head.get("ref", "") if head else ""
        if head_ref not in ("staging", "release", ""):
            feature_prs.append(pr)

    total_additions = 0
    total_deletions = 0
    contributors: set[str] = set()

    # Fetch stats and area breakdown for all PRs
    print(f"Fetching stats for {len(feature_prs)} PRs...", file=sys.stderr)
    for i, pr in enumerate(feature_prs, 1):
        print(f"  [{i}/{len(feature_prs)}] #{pr['number']}", file=sys.stderr)
        stats = get_pr_stats(owner, repo, pr["number"])
        pr["stats"] = stats
        pr["area_stats"] = get_pr_area_stats(owner, repo, pr["number"])
        total_additions += stats["additions"]
        total_deletions += stats["deletions"]
        contributors.add(pr["user"]["login"])
    print(file=sys.stderr)

    # Sort PRs by total lines changed (descending)
    sorted_prs = sorted(
        feature_prs,
        key=lambda pr: pr["stats"]["additions"] + pr["stats"]["deletions"],
        reverse=True,
    )

    quick_approvals = find_quick_approvals(owner, repo, feature_prs)

    hotfixes = [
        pr for pr in fetch_prs_by_base(owner, repo, "staging", since_date)
        if is_hotfix_to_staging(pr)
    ]
    backmerges = get_backmerges_since(owner, repo, since_date)
    reachable = get_backmerged_commits(hotfixes)  # Pre-compute for efficiency
    missing_backmerge = [
        hf for hf in hotfixes
        if not has_backmerge_after(hf, backmerges, reachable)
    ]

    train_date = current_date.strftime("%B %d")
    print(f"📦 *Release Preview: {train_date}*")
    print()
    print(f"Release Train: #{current_train['number']} merged {train_date}")
    print()
    print(f"{len(feature_prs)} PRs from {len(contributors)} contributors")
    print(f"Lines: +{total_additions:,} / -{total_deletions:,}")
    print()

    # All PRs sorted by size
    print("📋 *All PRs* (sorted by lines changed)")
    print()
    print("| PR | Lines | Author | Title | Areas |")
    print("|-----|-------|--------|-------|-------|")
    for pr in sorted_prs:
        add = pr["stats"]["additions"]
        delete = pr["stats"]["deletions"]
        title = pr["title"][:35] + ("..." if len(pr["title"]) > 35 else "")
        title = title.replace("|", "\\|")
        breakdown = format_area_breakdown(pr["area_stats"])
        link = pr_link(owner, repo, pr["number"])
        print(f"| [#{pr['number']}]({link}) | +{add}/-{delete} | "
              f"@{pr['user']['login']} | {title} | {breakdown} |")
    print()

    print("━" * 40)
    print()

    print("⚠️ *Risk Flags*")
    print()

    # Large PRs (500+ lines)
    large_prs = [pr for pr in sorted_prs
                 if pr["stats"]["additions"] + pr["stats"]["deletions"] >= 500]
    if large_prs:
        print(f"Large PRs (500+ lines): {len(large_prs)} PRs")
        for pr in large_prs[:3]:
            lines = pr["stats"]["additions"] + pr["stats"]["deletions"]
            print(f"  #{pr['number']} ({lines} lines)")
    else:
        print("Large PRs (500+ lines): None ✅")
    print()

    if quick_approvals:
        print(f"Quick approvals (<5 min, large or no comments): "
              f"{len(quick_approvals)} PRs")
        for pr in quick_approvals[:3]:
            print(f"  #{pr['number']} @{pr['user']['login']}")
    else:
        print("Quick approvals: None ✅")
    print()

    if missing_backmerge:
        print(f"Hotfixes needing backmerge: {len(missing_backmerge)} PRs")
        for hf in missing_backmerge:
            link = pr_link(owner, repo, hf["number"])
            print(f"  #{hf['number']} @{hf['user']['login']} {link}")
    else:
        print("Hotfixes needing backmerge: None ✅")
    print()

    print("🎯 *Monday QA Focus*")
    if large_prs:
        print("- Review large PRs for potential regressions:")
        for pr in large_prs[:3]:
            print(f"  - #{pr['number']}: {pr['title'][:40]}")
    else:
        print("- No high-risk items identified")


# -----------------------------------------------------------------------------
# Retro Report
# -----------------------------------------------------------------------------


def get_release_trend(owner: str, repo: str, count: int = 4) -> list[TrendEntry]:
    """Get stats for last N releases."""
    trains = find_release_trains(owner, repo, limit=count + 1, days=90)

    if len(trains) < 2:
        return []

    trend: list[TrendEntry] = []
    for i in range(len(trains) - 1):
        current = trains[i]
        previous = trains[i + 1]

        current_date = parse_datetime(current["merged_at"])
        previous_date = parse_datetime(previous["merged_at"])

        prs = fetch_prs_by_base(
            owner, repo, "develop", previous_date, current_date
        )
        filtered_prs = []
        for pr in prs:
            head = pr.get("head")
            head_ref = head.get("ref", "") if head else ""
            if head_ref not in ("staging", "release", ""):
                filtered_prs.append(pr)

        # Hotfix window: from current train until next train (or now)
        next_train_date = None
        if i > 0:
            next_train_date = parse_datetime(trains[i - 1]["merged_at"])

        # Staging hotfixes (during QA)
        staging_prs = fetch_prs_by_base(
            owner, repo, "staging", current_date, next_train_date
        )
        staging_hf = [pr for pr in staging_prs if is_hotfix_to_staging(pr)]

        # Release hotfixes (to prod)
        release_prs = fetch_prs_by_base(
            owner, repo, "release", current_date, next_train_date
        )
        release_hf = [pr for pr in release_prs if is_hotfix_to_release(pr)]

        has_hotfixes = len(staging_hf) > 0 or len(release_hf) > 0
        trend.append({
            "date": current_date.strftime("%m/%d"),
            "pr_count": len(filtered_prs),
            "staging_hf": len(staging_hf),
            "release_hf": len(release_hf),
            "outcome": "hotfix" if has_hotfixes else "clean",
        })

    return trend


def summarize_trend(trend: list[TrendEntry]) -> str:
    """Generate prose summary of release trend."""
    if not trend:
        return ""

    # Count consecutive hotfix releases from most recent
    consecutive = 0
    for t in trend:
        if t["outcome"] == "hotfix":
            consecutive += 1
        else:
            break

    total = sum(t["staging_hf"] + t["release_hf"] for t in trend)

    if consecutive == len(trend):
        return (
            f"{consecutive} consecutive releases with hotfixes "
            f"({total} total over {len(trend)} weeks)"
        )
    elif consecutive > 0:
        return (
            f"Last {consecutive} release(s) had hotfixes "
            f"({total} total over {len(trend)} weeks)"
        )
    return f"Last release was clean ({total} hotfixes over {len(trend)} weeks)"


def generate_action_items(
    staging_hotfixes: list[ReleasePR],
    release_hotfixes: list[ReleasePR],
) -> list[str]:
    """Generate actionable follow-ups."""
    items = []
    for hf in staging_hotfixes + release_hotfixes:
        if not hf.get("backmerged"):
            items.append(
                f"@{hf['user']['login']} — backmerge #{hf['number']} to develop"
            )
    return items


def cmd_retro(owner: str, repo: str, days: int = 30) -> None:
    """Generate release retro report."""
    trains = find_release_trains(owner, repo, limit=2, days=days)

    if not trains:
        print(f"No release train found in last {days} days.")
        print("Run this command after a release train is merged.")
        return

    release_train = trains[0]
    staging_date = parse_datetime(release_train["merged_at"])

    promotion = find_last_promotion(owner, repo, days)
    prod_date = parse_datetime(promotion["merged_at"]) if promotion else None

    # Promotion must be after staging to be for this cycle
    if prod_date and prod_date < staging_date:
        prod_date = None

    if len(trains) > 1:
        previous_train = trains[1]
        since_date = parse_datetime(previous_train["merged_at"])
    else:
        since_date = staging_date - timedelta(days=7)

    # Feature PRs (what shipped)
    all_prs = fetch_prs_by_base(
        owner, repo, "develop", since_date, staging_date
    )
    feature_prs: list[ReleasePR] = []
    for pr in all_prs:
        head = pr.get("head")
        head_ref = head.get("ref", "") if head else ""
        if head_ref not in ("staging", "release", ""):
            feature_prs.append(pr)

    total_additions = 0
    total_deletions = 0
    contributor_counts: dict[str, int] = {}

    # Fetch stats and area breakdown for all PRs
    print(f"Fetching stats for {len(feature_prs)} PRs...", file=sys.stderr)
    for i, pr in enumerate(feature_prs, 1):
        print(f"  [{i}/{len(feature_prs)}] #{pr['number']}", file=sys.stderr)
        stats = get_pr_stats(owner, repo, pr["number"])
        pr["stats"] = stats
        pr["area_stats"] = get_pr_area_stats(owner, repo, pr["number"])
        total_additions += stats["additions"]
        total_deletions += stats["deletions"]
        author = pr["user"]["login"]
        contributor_counts[author] = contributor_counts.get(author, 0) + 1
    print(file=sys.stderr)

    # Sort PRs by total lines changed (descending)
    sorted_prs = sorted(
        feature_prs,
        key=lambda pr: pr["stats"]["additions"] + pr["stats"]["deletions"],
        reverse=True,
    )

    # Staging hotfixes (during QA)
    staging_prs = fetch_prs_by_base(owner, repo, "staging", staging_date)
    staging_hotfixes = [pr for pr in staging_prs if is_hotfix_to_staging(pr)]

    # Release hotfixes (to prod)
    release_prs = fetch_prs_by_base(owner, repo, "release", staging_date)
    release_hotfixes = [pr for pr in release_prs if is_hotfix_to_release(pr)]

    # Check backmerge status for all hotfixes
    # Pre-compute reachable commits for all hotfixes (more efficient)
    all_hotfixes = staging_hotfixes + release_hotfixes
    reachable = get_backmerged_commits(all_hotfixes)

    backmerges = get_backmerges_since(owner, repo, staging_date)
    for hf in staging_hotfixes:
        hf["backmerged"] = has_backmerge_after(hf, backmerges, reachable)
    for hf in release_hotfixes:
        hf["backmerged"] = has_backmerge_after(hf, backmerges, reachable)

    has_hotfixes = len(staging_hotfixes) > 0 or len(release_hotfixes) > 0

    trend = get_release_trend(owner, repo, count=4)
    action_items = generate_action_items(staging_hotfixes, release_hotfixes)

    # --- Output ---
    pacific = ZoneInfo("America/Los_Angeles")

    prev_date_str = since_date.strftime("%b %d")
    curr_date_str = staging_date.strftime("%b %d")
    print(f"📦 *Release Retro: {prev_date_str} → {curr_date_str}*")
    print("(All times Pacific)")
    print()

    staging_pt = staging_date.astimezone(pacific)
    staging_str = staging_pt.strftime("%a %b %d %I:%M%p") + " PT"
    print(f"Staging: {staging_str} ✅")

    if prod_date:
        prod_pt = prod_date.astimezone(pacific)
        prod_str = prod_pt.strftime("%a %b %d %I:%M%p") + " PT"
        print(f"Prod: {prod_str} ✅")
    else:
        print("Prod: Pending")
    print()

    print("━" * 40)
    print()

    # Outcome section
    if not has_hotfixes:
        print("🚦 *Outcome: ✅ Clean Release*")
    else:
        print("🚦 *Outcome: ⚠️ Hotfixes Required*")
        print()
        if staging_hotfixes:
            print(f"  {len(staging_hotfixes)} hotfix(es) to staging (during QA)")
        if release_hotfixes:
            print(f"  {len(release_hotfixes)} hotfix(es) to release (prod)")
    print()

    print("━" * 40)
    print()

    # What Shipped
    print("📊 *What Shipped*")
    print()
    pr_count = len(feature_prs)
    contrib_count = len(contributor_counts)
    print(f"{pr_count} PRs from {contrib_count} contributors")
    print(f"Lines: +{total_additions:,} / -{total_deletions:,}")
    print()

    if contributor_counts:
        print("Top contributors:")
        sorted_contributors = sorted(
            contributor_counts.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        for author, count in sorted_contributors[:5]:
            print(f"  @{author}    {count} PRs")
    print()

    # All PRs sorted by size
    print("📋 *All PRs* (sorted by lines changed)")
    print()
    print("| PR | Lines | Author | Title | Areas |")
    print("|-----|-------|--------|-------|-------|")
    for pr in sorted_prs:
        add = pr["stats"]["additions"]
        delete = pr["stats"]["deletions"]
        title = pr["title"][:35] + ("..." if len(pr["title"]) > 35 else "")
        title = title.replace("|", "\\|")
        breakdown = format_area_breakdown(pr["area_stats"])
        link = pr_link(owner, repo, pr["number"])
        print(f"| [#{pr['number']}]({link}) | +{add}/-{delete} | "
              f"@{pr['user']['login']} | {title} | {breakdown} |")
    print()

    print("━" * 40)
    print()

    # Staging Hotfixes
    print(f"🚨 *Staging Hotfixes* ({len(staging_hotfixes)} PRs during QA)")
    print()
    if staging_hotfixes:
        print("| PR | Author | Title | Status |")
        print("|-----|--------|-------|--------|")
        for hf in staging_hotfixes:
            title = hf["title"][:40] + ("..." if len(hf["title"]) > 40 else "")
            title = title.replace("|", "\\|")
            status = "✅" if hf["backmerged"] else "❌ BACKMERGE"
            link = pr_link(owner, repo, hf["number"])
            print(f"| [#{hf['number']}]({link}) | @{hf['user']['login']} | "
                  f"{title} | {status} |")
    else:
        print("None 🎉")
    print()

    print("━" * 40)
    print()

    # Release Hotfixes
    print(f"🔥 *Release Hotfixes* ({len(release_hotfixes)} PRs to prod)")
    print()
    if release_hotfixes:
        print("| PR | Author | Title | Status |")
        print("|-----|--------|-------|--------|")
        for hf in release_hotfixes:
            title = hf["title"][:40] + ("..." if len(hf["title"]) > 40 else "")
            title = title.replace("|", "\\|")
            status = "✅" if hf["backmerged"] else "❌ BACKMERGE"
            link = pr_link(owner, repo, hf["number"])
            print(f"| [#{hf['number']}]({link}) | @{hf['user']['login']} | "
                  f"{title} | {status} |")
    else:
        print("None 🎉")
    print()

    print("━" * 40)
    print()

    # Trend
    print("📈 *Trend (Last 4 Releases)*")
    print()
    if trend:
        print("| Release | PRs | Staging HF | Release HF | Outcome |")
        print("|---------|-----|------------|------------|---------|")
        for t in trend:
            outcome_icon = "✅" if t["outcome"] == "clean" else "⚠️"
            print(f"| {t['date']} | {t['pr_count']} | "
                  f"{t['staging_hf']} | {t['release_hf']} | {outcome_icon} |")
        print()
        trend_summary = summarize_trend(trend)
        if trend_summary:
            print(trend_summary)
    else:
        print("Not enough release history for trend data.")
    print()

    # Action Items
    if action_items:
        print("━" * 40)
        print()
        print("🎯 *Action Items*")
        print()
        for item in action_items:
            print(f"- {item}")


# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Release reports for weekly release cycle"
    )
    parser.add_argument(
        "--action",
        choices=["preview", "retro"],
        required=True,
        help="Report type: preview (Sunday) or retro (Tuesday)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Days to look back for release trains (default: 30)",
    )
    return parser.parse_args()


def main() -> None:
    """Main entry point."""
    args = parse_args()
    owner, repo = get_repo_info()

    if args.action == "preview":
        cmd_preview(owner, repo, args.days)
    elif args.action == "retro":
        cmd_retro(owner, repo, args.days)


if __name__ == "__main__":
    main()
