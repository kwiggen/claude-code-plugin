#!/usr/bin/env python3
"""GitHub stats script for team insights.

Uses `gh api` to fetch PR data from the current repository.
"""

import argparse
import json
import statistics
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone


def get_repo_info() -> tuple[str, str]:
    """Get owner/repo from git remote."""
    result = subprocess.run(
        ["gh", "repo", "view", "--json", "owner,name"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(
            "Error: Could not determine repository. Are you in a git repo?",
            file=sys.stderr,
        )
        sys.exit(1)

    data = json.loads(result.stdout)
    return data["owner"]["login"], data["name"]


def fetch_merged_prs(owner: str, repo: str, since: datetime) -> list[dict]:
    """Fetch all merged PRs since the given date."""
    prs: list[dict] = []
    page = 1
    per_page = 100

    while True:
        result = subprocess.run(
            [
                "gh", "api",
                f"repos/{owner}/{repo}/pulls",
                "-X", "GET",
                "-f", "state=closed",
                "-f", f"per_page={per_page}",
                "-f", f"page={page}",
            ],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            print(f"Error fetching PRs: {result.stderr}", file=sys.stderr)
            sys.exit(1)

        page_prs = json.loads(result.stdout)
        if not page_prs:
            break

        for pr in page_prs:
            if pr.get("merged_at"):
                merged_str = pr["merged_at"].replace("Z", "+00:00")
                merged_at = datetime.fromisoformat(merged_str)
                if merged_at >= since:
                    prs.append(pr)
                elif merged_at < since:
                    return prs

        page += 1
        if len(page_prs) < per_page:
            break

    return prs


def get_pr_stats(owner: str, repo: str, pr_number: int) -> dict:
    """Get additions/deletions for a PR."""
    result = subprocess.run(
        ["gh", "api", f"repos/{owner}/{repo}/pulls/{pr_number}"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return {"additions": 0, "deletions": 0}

    data = json.loads(result.stdout)
    return {
        "additions": data.get("additions", 0),
        "deletions": data.get("deletions", 0),
    }


def format_date(iso_date: str) -> str:
    """Format ISO date to readable format."""
    dt = datetime.fromisoformat(iso_date.replace("Z", "+00:00"))
    return dt.strftime("%b %d")


def format_duration(td: timedelta) -> str:
    """Format timedelta to human readable string."""
    total_hours = td.total_seconds() / 3600
    if total_hours < 1:
        minutes = int(td.total_seconds() / 60)
        return f"{minutes} min"
    elif total_hours < 24:
        return f"{total_hours:.1f} hrs"
    else:
        days = total_hours / 24
        return f"{days:.1f} days"


def parse_datetime(iso_date: str) -> datetime:
    """Parse ISO datetime string to datetime object."""
    return datetime.fromisoformat(iso_date.replace("Z", "+00:00"))


def fetch_pr_reviews(owner: str, repo: str, pr_number: int) -> list[dict]:
    """Fetch reviews for a specific PR."""
    result = subprocess.run(
        ["gh", "api", f"repos/{owner}/{repo}/pulls/{pr_number}/reviews"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return []
    return json.loads(result.stdout)


def cmd_prs_merged(
    owner: str, repo: str, since: datetime, show_stats: bool = True
) -> None:
    """List merged PRs."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    print(f"## PRs Merged ({len(prs)} total)\n")

    if show_stats:
        print("| PR | Author | Merged | +/- |")
        print("|----|--------|--------|-----|")
    else:
        print("| PR | Author | Merged |")
        print("|----|--------|--------|")

    for pr in prs:
        pr_num = pr["number"]
        title = pr["title"][:50] + ("..." if len(pr["title"]) > 50 else "")
        author = pr["user"]["login"]
        merged = format_date(pr["merged_at"])

        if show_stats:
            stats = get_pr_stats(owner, repo, pr_num)
            changes = f"+{stats['additions']}/-{stats['deletions']}"
            print(f"| #{pr_num} {title} | @{author} | {merged} | {changes} |")
        else:
            print(f"| #{pr_num} {title} | @{author} | {merged} |")


def cmd_leaderboard(owner: str, repo: str, since: datetime) -> None:
    """Show PR leaderboard by author."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    author_stats: dict[str, dict] = {}

    for pr in prs:
        author = pr["user"]["login"]
        if author not in author_stats:
            author_stats[author] = {"count": 0, "additions": 0, "deletions": 0}

        author_stats[author]["count"] += 1
        stats = get_pr_stats(owner, repo, pr["number"])
        author_stats[author]["additions"] += stats["additions"]
        author_stats[author]["deletions"] += stats["deletions"]

    sorted_authors = sorted(
        author_stats.items(),
        key=lambda x: x[1]["count"],
        reverse=True,
    )

    print("## Leaderboard\n")
    print("| Developer | PRs | Lines Changed |")
    print("|-----------|-----|---------------|")

    for author, stats in sorted_authors:
        changes = f"+{stats['additions']:,}/-{stats['deletions']:,}"
        print(f"| @{author} | {stats['count']} | {changes} |")


def cmd_activity(owner: str, repo: str, since: datetime) -> None:
    """Show activity summary."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    total_additions = 0
    total_deletions = 0
    authors: set[str] = set()

    for pr in prs:
        authors.add(pr["user"]["login"])
        stats = get_pr_stats(owner, repo, pr["number"])
        total_additions += stats["additions"]
        total_deletions += stats["deletions"]

    days = (datetime.now(timezone.utc) - since).days or 1

    print("## Activity Summary\n")
    print(f"- **PRs Merged:** {len(prs)}")
    print(f"- **Contributors:** {len(authors)}")
    print(f"- **Lines Added:** +{total_additions:,}")
    print(f"- **Lines Removed:** -{total_deletions:,}")
    print(f"- **Net Change:** {total_additions - total_deletions:+,}")
    print(f"- **PRs/Day:** {len(prs) / days:.1f}")
    print()

    cmd_leaderboard(owner, repo, since)


def cmd_time_to_merge(owner: str, repo: str, since: datetime) -> None:
    """Show time-to-merge statistics per developer."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    author_times: dict[str, list[timedelta]] = defaultdict(list)
    all_times: list[timedelta] = []

    for pr in prs:
        created = parse_datetime(pr["created_at"])
        merged = parse_datetime(pr["merged_at"])
        merge_time = merged - created
        author = pr["user"]["login"]
        author_times[author].append(merge_time)
        all_times.append(merge_time)

    print("## Time to Merge\n")
    print("| Developer | PRs | Avg Time | Median Time | Fastest | Slowest |")
    print("|-----------|-----|----------|-------------|---------|---------|")

    sorted_authors = sorted(
        author_times.items(),
        key=lambda x: len(x[1]),
        reverse=True,
    )

    for author, times in sorted_authors:
        count = len(times)
        avg_seconds = sum(t.total_seconds() for t in times) / count
        avg_time = timedelta(seconds=avg_seconds)
        median_time = timedelta(
            seconds=statistics.median(t.total_seconds() for t in times)
        )
        fastest = min(times)
        slowest = max(times)
        print(
            f"| @{author} | {count} | {format_duration(avg_time)} | "
            f"{format_duration(median_time)} | {format_duration(fastest)} | "
            f"{format_duration(slowest)} |"
        )

    if all_times:
        print()
        team_avg = timedelta(
            seconds=sum(t.total_seconds() for t in all_times) / len(all_times)
        )
        team_median = timedelta(
            seconds=statistics.median(t.total_seconds() for t in all_times)
        )
        print(
            f"**Team Average:** {format_duration(team_avg)} | "
            f"**Team Median:** {format_duration(team_median)}"
        )


def cmd_reviews(owner: str, repo: str, since: datetime) -> None:
    """Show review participation report."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    reviewer_stats: dict[str, dict[str, int]] = defaultdict(
        lambda: defaultdict(int)
    )
    reviewer_totals: dict[str, int] = defaultdict(int)

    for pr in prs:
        author = pr["user"]["login"]
        reviews = fetch_pr_reviews(owner, repo, pr["number"])

        seen_reviewers: set[str] = set()
        for review in reviews:
            reviewer = review["user"]["login"]
            if reviewer != author and reviewer not in seen_reviewers:
                reviewer_stats[reviewer][author] += 1
                reviewer_totals[reviewer] += 1
                seen_reviewers.add(reviewer)

    if not reviewer_totals:
        print("No reviews found in the specified time range.")
        return

    print("## Review Participation\n")
    print("| Reviewer | Reviews Given | Authors Reviewed |")
    print("|----------|---------------|------------------|")

    sorted_reviewers = sorted(
        reviewer_totals.items(),
        key=lambda x: x[1],
        reverse=True,
    )

    for reviewer, total in sorted_reviewers:
        authors_reviewed = sorted(
            reviewer_stats[reviewer].items(),
            key=lambda x: x[1],
            reverse=True,
        )
        authors_str = ", ".join(
            f"@{a} ({c})" for a, c in authors_reviewed
        )
        print(f"| @{reviewer} | {total} | {authors_str} |")


def cmd_pr_size(owner: str, repo: str, since: datetime) -> None:
    """Show PR size analysis with merge time correlation."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    size_buckets: dict[str, list[dict]] = {
        "Small (<100)": [],
        "Medium (100-500)": [],
        "Large (500+)": [],
    }

    for pr in prs:
        stats = get_pr_stats(owner, repo, pr["number"])
        total_lines = stats["additions"] + stats["deletions"]
        created = parse_datetime(pr["created_at"])
        merged = parse_datetime(pr["merged_at"])
        merge_time = merged - created

        pr_data = {
            "number": pr["number"],
            "title": pr["title"],
            "author": pr["user"]["login"],
            "additions": stats["additions"],
            "deletions": stats["deletions"],
            "total": total_lines,
            "merge_time": merge_time,
        }

        if total_lines < 100:
            size_buckets["Small (<100)"].append(pr_data)
        elif total_lines < 500:
            size_buckets["Medium (100-500)"].append(pr_data)
        else:
            size_buckets["Large (500+)"].append(pr_data)

    print("## PR Size Analysis\n")
    print("### Size Distribution\n")
    print("| Size | Count | Avg Merge Time |")
    print("|------|-------|----------------|")

    bucket_avgs: dict[str, float] = {}
    for bucket_name in ["Small (<100)", "Medium (100-500)", "Large (500+)"]:
        bucket_prs = size_buckets[bucket_name]
        count = len(bucket_prs)
        if count > 0:
            avg_seconds = sum(
                p["merge_time"].total_seconds() for p in bucket_prs
            ) / count
            avg_time = timedelta(seconds=avg_seconds)
            bucket_avgs[bucket_name] = avg_seconds
            print(f"| {bucket_name} | {count} | {format_duration(avg_time)} |")
        else:
            print(f"| {bucket_name} | 0 | - |")

    large_prs = size_buckets["Large (500+)"]
    if large_prs:
        print("\n### Large PRs (potential bottlenecks)\n")
        print("| PR | Author | Lines | Time to Merge |")
        print("|----|--------|-------|---------------|")

        sorted_large = sorted(
            large_prs, key=lambda x: x["total"], reverse=True
        )
        for pr_data in sorted_large[:5]:
            raw_title = pr_data["title"]
            title = raw_title[:40] + ("..." if len(raw_title) > 40 else "")
            print(
                f"| #{pr_data['number']} {title} | @{pr_data['author']} | "
                f"+{pr_data['additions']}/-{pr_data['deletions']} | "
                f"{format_duration(pr_data['merge_time'])} |"
            )

    if "Small (<100)" in bucket_avgs and "Large (500+)" in bucket_avgs:
        if bucket_avgs["Small (<100)"] > 0:
            ratio = bucket_avgs["Large (500+)"] / bucket_avgs["Small (<100)"]
            print("\n### Correlation\n")
            print(
                f"Large PRs take **{ratio:.1f}x longer** "
                "to merge than small PRs."
            )


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="GitHub team stats")
    parser.add_argument(
        "--action",
        choices=[
            "prs-merged", "leaderboard", "activity",
            "time-to-merge", "reviews", "pr-size",
        ],
        required=True,
        help="Action to perform",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to look back (default: 30)",
    )
    parser.add_argument(
        "--start",
        type=str,
        help="Start date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--end",
        type=str,
        help="End date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--no-stats",
        action="store_true",
        help="Skip fetching line stats (faster)",
    )
    return parser.parse_args()


def main() -> None:
    """Main entry point."""
    args = parse_args()

    owner, repo = get_repo_info()

    if args.start:
        since = datetime.fromisoformat(args.start).replace(tzinfo=timezone.utc)
    else:
        since = datetime.now(timezone.utc) - timedelta(days=args.days)

    if args.action == "prs-merged":
        cmd_prs_merged(owner, repo, since, show_stats=not args.no_stats)
    elif args.action == "leaderboard":
        cmd_leaderboard(owner, repo, since)
    elif args.action == "activity":
        cmd_activity(owner, repo, since)
    elif args.action == "time-to-merge":
        cmd_time_to_merge(owner, repo, since)
    elif args.action == "reviews":
        cmd_reviews(owner, repo, since)
    elif args.action == "pr-size":
        cmd_pr_size(owner, repo, since)


if __name__ == "__main__":
    main()
