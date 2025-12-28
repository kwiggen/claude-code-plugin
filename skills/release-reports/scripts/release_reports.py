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
)


# -----------------------------------------------------------------------------
# PR Classification Functions
# -----------------------------------------------------------------------------

# Release train branch patterns
RELEASE_TRAIN_PATTERNS = [
    r"^staging-\d{2}-\d{2}-\d{2}$",   # staging-12-21-25
    r"^release-\d{2}-\d{2}-\d{2}$",   # release-12-14-25
    r"^release-to-staging$",
]


def is_release_train(pr: dict) -> bool:
    """Check if PR is a release train (dated branch → staging)."""
    if pr.get("base", {}).get("ref") != "staging":
        return False
    head_ref = pr.get("head", {}).get("ref", "")
    return any(re.match(p, head_ref) for p in RELEASE_TRAIN_PATTERNS)


def is_promotion(pr: dict) -> bool:
    """Check if PR is a promotion (staging → release)."""
    return (
        pr.get("base", {}).get("ref") == "release"
        and pr.get("head", {}).get("ref") == "staging"
    )


def is_backmerge(pr: dict) -> bool:
    """Check if PR is a backmerge (staging → develop)."""
    return (
        pr.get("base", {}).get("ref") == "develop"
        and pr.get("head", {}).get("ref") == "staging"
    )


def is_hotfix_to_staging(pr: dict) -> bool:
    """Check if PR is a hotfix to staging (not a release train)."""
    if pr.get("base", {}).get("ref") != "staging":
        return False
    if is_release_train(pr):
        return False
    # Exclude release→staging backmerges
    if pr.get("head", {}).get("ref") == "release":
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
) -> list[dict]:
    """Fetch merged PRs to a specific base branch within a date range."""
    prs: list[dict] = []
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
) -> list[dict]:
    """Find the most recent release train PRs (dated branch → staging)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    staging_prs = fetch_prs_by_base(owner, repo, "staging", since)
    trains = [pr for pr in staging_prs if is_release_train(pr)]
    return trains[:limit]


def find_last_promotion(
    owner: str, repo: str, days: int = 30
) -> dict | None:
    """Find the most recent promotion PR (staging → release)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    release_prs = fetch_prs_by_base(owner, repo, "release", since)
    promotions = [pr for pr in release_prs if is_promotion(pr)]
    return promotions[0] if promotions else None


def get_backmerges_since(
    owner: str, repo: str, since: datetime
) -> list[dict]:
    """Get backmerge PRs (staging → develop) since a date."""
    develop_prs = fetch_prs_by_base(owner, repo, "develop", since)
    return [pr for pr in develop_prs if is_backmerge(pr)]


def has_backmerge_after(hotfix: dict, backmerges: list[dict]) -> bool:
    """Check if a hotfix has been backmerged."""
    hotfix_merged = parse_datetime(hotfix["merged_at"])
    hotfix_title = hotfix.get("title", "").lower()
    hotfix_number = hotfix["number"]

    for bm in backmerges:
        bm_merged = parse_datetime(bm["merged_at"])
        if bm_merged <= hotfix_merged:
            continue

        bm_title = bm.get("title", "").lower()
        bm_body = bm.get("body", "").lower() if bm.get("body") else ""

        if (
            str(hotfix_number) in bm_title
            or str(hotfix_number) in bm_body
            or hotfix_title in bm_title
        ):
            return True

    return False


def find_quick_approvals(
    owner: str, repo: str, prs: list[dict]
) -> list[dict]:
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

            if not review.get("submitted_at"):
                continue

            submitted = parse_datetime(review["submitted_at"])
            review_time = (submitted - created).total_seconds() / 60

            if review_time < 5:
                if is_large or len(comments) == 0:
                    quick_approvals.append({
                        **pr,
                        "review_time_min": review_time,
                        "is_large": is_large,
                        "comment_count": len(comments),
                    })
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

    feature_prs = fetch_prs_by_base(
        owner, repo, "develop", since_date, current_date
    )
    feature_prs = [
        pr for pr in feature_prs
        if pr.get("head", {}).get("ref") not in ["staging", "release"]
    ]

    total_additions = 0
    total_deletions = 0
    contributors: set[str] = set()

    for pr in feature_prs:
        stats = get_pr_stats(owner, repo, pr["number"])
        pr["stats"] = stats
        total_additions += stats["additions"]
        total_deletions += stats["deletions"]
        contributors.add(pr["user"]["login"])

    large_prs = [
        pr for pr in feature_prs
        if pr["stats"]["additions"] + pr["stats"]["deletions"] >= 500
    ]

    quick_approvals = find_quick_approvals(owner, repo, feature_prs)

    hotfixes = [
        pr for pr in fetch_prs_by_base(owner, repo, "staging", since_date)
        if is_hotfix_to_staging(pr)
    ]
    backmerges = get_backmerges_since(owner, repo, since_date)
    missing_backmerge = [
        hf for hf in hotfixes if not has_backmerge_after(hf, backmerges)
    ]

    train_date = current_date.strftime("%B %d")
    print(f"📦 *Release Preview: {train_date}*")
    print()
    print(f"Release Train: #{current_train['number']} merged {train_date}")
    print()
    print(f"{len(feature_prs)} PRs from {len(contributors)} contributors")
    print(f"Lines: +{total_additions:,} / -{total_deletions:,}")
    print()

    print("⚠️ *Risk Flags*")
    print()

    if large_prs:
        print("Large PRs (500+ lines):")
        for pr in large_prs:
            lines = pr["stats"]["additions"] + pr["stats"]["deletions"]
            title = pr["title"][:50] + ("..." if len(pr["title"]) > 50 else "")
            print(f"  #{pr['number']} @{pr['user']['login']} \"{title}\" "
                  f"({lines} lines)")
    else:
        print("Large PRs (500+ lines): None ✅")
    print()

    if quick_approvals:
        print("Quick approvals (<5 min, large or no comments):")
        for pr in quick_approvals:
            title = pr["title"][:50] + ("..." if len(pr["title"]) > 50 else "")
            print(f"  #{pr['number']} @{pr['user']['login']} \"{title}\"")
    else:
        print("Quick approvals: None ✅")
    print()

    if missing_backmerge:
        print("Hotfixes needing backmerge (from previous cycle):")
        for hf in missing_backmerge:
            title = hf["title"][:50] + ("..." if len(hf["title"]) > 50 else "")
            print(f"  #{hf['number']} → staging @{hf['user']['login']} "
                  f"\"{title}\"")
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


def get_release_trend(owner: str, repo: str, count: int = 4) -> list[dict]:
    """Get stats for last N releases."""
    trains = find_release_trains(owner, repo, limit=count + 1, days=90)

    if len(trains) < 2:
        return []

    trend = []
    for i in range(len(trains) - 1):
        current = trains[i]
        previous = trains[i + 1]

        current_date = parse_datetime(current["merged_at"])
        previous_date = parse_datetime(previous["merged_at"])

        prs = fetch_prs_by_base(
            owner, repo, "develop", previous_date, current_date
        )
        prs = [
            pr for pr in prs
            if pr.get("head", {}).get("ref") not in ["staging", "release"]
        ]

        # Hotfix window: from current train until next train (or now)
        next_train_date = None
        if i > 0:
            next_train_date = parse_datetime(trains[i - 1]["merged_at"])
        staging_prs = fetch_prs_by_base(
            owner, repo, "staging", current_date, next_train_date
        )
        hotfixes = [pr for pr in staging_prs if is_hotfix_to_staging(pr)]

        trend.append({
            "date": current_date.strftime("%m/%d"),
            "pr_count": len(prs),
            "hotfix_count": len(hotfixes),
            "outcome": "hotfix" if hotfixes else "clean",
        })

    return trend


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

    feature_prs = fetch_prs_by_base(
        owner, repo, "develop", since_date, staging_date
    )
    feature_prs = [
        pr for pr in feature_prs
        if pr.get("head", {}).get("ref") not in ["staging", "release"]
    ]

    total_additions = 0
    total_deletions = 0
    contributor_counts: dict[str, int] = {}

    for pr in feature_prs:
        stats = get_pr_stats(owner, repo, pr["number"])
        total_additions += stats["additions"]
        total_deletions += stats["deletions"]
        author = pr["user"]["login"]
        contributor_counts[author] = contributor_counts.get(author, 0) + 1

    staging_prs = fetch_prs_by_base(owner, repo, "staging", staging_date)
    hotfixes = [pr for pr in staging_prs if is_hotfix_to_staging(pr)]

    backmerges = get_backmerges_since(owner, repo, staging_date)
    for hf in hotfixes:
        hf["backmerged"] = has_backmerge_after(hf, backmerges)

    outcome = "hotfix" if hotfixes else "clean"

    trend = get_release_trend(owner, repo, count=4)

    prev_date_str = since_date.strftime("%b %d")
    curr_date_str = staging_date.strftime("%b %d")
    print(f"📦 *Release Retro: {prev_date_str} → {curr_date_str}*")
    print()

    staging_str = staging_date.strftime("%a %b %d %I%p")
    print(f"Staging: {staging_str} ✅")

    if prod_date:
        prod_str = prod_date.strftime("%a %b %d %I%p")
        print(f"Prod: {prod_str} ✅")
    else:
        print("Prod: Pending")
    print()

    print("━" * 40)
    print()

    if outcome == "clean":
        print("🚦 *Outcome: ✅ Clean Release*")
    else:
        print("🚦 *Outcome: ⚠️ Hotfixes Required*")
    print()

    print("━" * 40)
    print()

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

    print("━" * 40)
    print()

    print("🚨 *Hotfixes During QA* (direct PRs to staging)")
    print()
    if hotfixes:
        for hf in hotfixes:
            title = hf["title"][:40] + ("..." if len(hf["title"]) > 40 else "")
            backmerged = hf["backmerged"]
            status = "✅ backmerged" if backmerged else "❌ NEEDS BACKMERGE"
            print(f"#{hf['number']}  @{hf['user']['login']}  \"{title}\"  "
                  f"{status}")
    else:
        print("None - clean release! 🎉")
    print()

    print("━" * 40)
    print()

    print("📈 *Trend (Last 4 Releases)*")
    print()
    if trend:
        print("| Release | PRs | Hotfixes | Outcome |")
        print("|---------|-----|----------|---------|")
        for t in trend:
            outcome_icon = "✅" if t["outcome"] == "clean" else "⚠️"
            print(f"| {t['date']} | {t['pr_count']} | "
                  f"{t['hotfix_count']} | {outcome_icon} |")
    else:
        print("Not enough release history for trend data.")


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
