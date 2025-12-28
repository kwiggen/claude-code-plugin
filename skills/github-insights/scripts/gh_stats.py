#!/usr/bin/env python3
"""GitHub stats script for team insights.

Uses `gh api` to fetch PR data from the current repository.
"""

import argparse
import json
import re
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


def fetch_pr_comments(owner: str, repo: str, pr_number: int) -> list[dict]:
    """Fetch review comments for a specific PR."""
    result = subprocess.run(
        ["gh", "api", f"repos/{owner}/{repo}/pulls/{pr_number}/comments"],
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
    """Show activity summary with day/hour breakdown."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    total_additions = 0
    total_deletions = 0
    authors: set[str] = set()
    day_counts: dict[str, int] = defaultdict(int)
    hour_counts: dict[int, int] = defaultdict(int)

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday",
                 "Friday", "Saturday", "Sunday"]

    for pr in prs:
        authors.add(pr["user"]["login"])
        stats = get_pr_stats(owner, repo, pr["number"])
        total_additions += stats["additions"]
        total_deletions += stats["deletions"]

        merged_at = parse_datetime(pr["merged_at"])
        day_name = day_names[merged_at.weekday()]
        day_counts[day_name] += 1
        hour_counts[merged_at.hour] += 1

    days = (datetime.now(timezone.utc) - since).days or 1

    print("## Activity Summary\n")
    print(f"- **PRs Merged:** {len(prs)}")
    print(f"- **Contributors:** {len(authors)}")
    print(f"- **Lines Added:** +{total_additions:,}")
    print(f"- **Lines Removed:** -{total_deletions:,}")
    print(f"- **Net Change:** {total_additions - total_deletions:+,}")
    print(f"- **PRs/Day:** {len(prs) / days:.1f}")
    print()

    print("### Merge Distribution by Day\n")
    print("| Day | PRs Merged | Percentage |")
    print("|-----|------------|------------|")

    total_prs = len(prs)
    for day in day_names[:5]:
        count = day_counts.get(day, 0)
        pct = (count / total_prs * 100) if total_prs > 0 else 0
        print(f"| {day} | {count} | {pct:.0f}% |")

    weekend_count = day_counts.get("Saturday", 0) + day_counts.get("Sunday", 0)
    weekend_pct = (weekend_count / total_prs * 100) if total_prs > 0 else 0
    print(f"| Weekend | {weekend_count} | {weekend_pct:.0f}% |")

    if hour_counts:
        print("\n### Busiest Hours (UTC)\n")
        print("| Hour | PRs Merged |")
        print("|------|------------|")

        sorted_hours = sorted(
            hour_counts.items(),
            key=lambda x: x[1],
            reverse=True,
        )[:5]

        for hour, count in sorted_hours:
            print(f"| {hour:02d}:00-{hour:02d}:59 | {count} |")

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


def cmd_first_review(owner: str, repo: str, since: datetime) -> None:
    """Show time to first review per developer."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    author_times: dict[str, list[timedelta]] = defaultdict(list)
    all_times: list[timedelta] = []

    for pr in prs:
        reviews = fetch_pr_reviews(owner, repo, pr["number"])
        if not reviews:
            continue

        created = parse_datetime(pr["created_at"])
        author = pr["user"]["login"]

        # Find the earliest review
        first_review_time = None
        for review in reviews:
            if review.get("submitted_at"):
                review_time = parse_datetime(review["submitted_at"])
                no_first = first_review_time is None
                is_earlier = no_first or review_time < first_review_time
                if is_earlier:
                    first_review_time = review_time

        if first_review_time:
            wait_time = first_review_time - created
            if wait_time.total_seconds() > 0:
                author_times[author].append(wait_time)
                all_times.append(wait_time)

    if not all_times:
        print("No reviews found in the specified time range.")
        return

    print("## Time to First Review\n")
    print("| Developer | PRs | Avg Wait | Median Wait | Fastest | Slowest |")
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


def cmd_review_balance(owner: str, repo: str, since: datetime) -> None:
    """Show review balance - reviews given vs received per developer."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    reviews_given: dict[str, int] = defaultdict(int)
    reviews_received: dict[str, int] = defaultdict(int)

    for pr in prs:
        author = pr["user"]["login"]
        reviews = fetch_pr_reviews(owner, repo, pr["number"])

        seen_reviewers: set[str] = set()
        for review in reviews:
            reviewer = review["user"]["login"]
            if reviewer != author and reviewer not in seen_reviewers:
                reviews_given[reviewer] += 1
                seen_reviewers.add(reviewer)

        if seen_reviewers:
            reviews_received[author] += len(seen_reviewers)

    all_users = set(reviews_given.keys()) | set(reviews_received.keys())

    if not all_users:
        print("No reviews found in the specified time range.")
        return

    print("## Review Balance\n")
    print("| Developer | Reviews Given | Reviews Received | Ratio |")
    print("|-----------|---------------|------------------|-------|")

    user_data: list[tuple[str, int, int, float]] = []
    for user in all_users:
        given = reviews_given.get(user, 0)
        received = reviews_received.get(user, 0)
        if received > 0:
            ratio = given / received
        elif given > 0:
            ratio = float("inf")
        else:
            ratio = 0.0
        user_data.append((user, given, received, ratio))

    sorted_users = sorted(user_data, key=lambda x: x[1], reverse=True)

    for user, given, received, ratio in sorted_users:
        if ratio == float("inf"):
            ratio_str = "inf"
        else:
            ratio_str = f"{ratio:.1f}x"
        print(f"| @{user} | {given} | {received} | {ratio_str} |")

    total_given = sum(reviews_given.values())
    total_received = sum(reviews_received.values())
    if total_received > 0:
        avg_ratio = total_given / total_received
        if 0.8 <= avg_ratio <= 1.2:
            balance_status = "Balanced"
        elif avg_ratio < 0.8:
            balance_status = "Under-reviewing"
        else:
            balance_status = "Over-reviewing"
        ratio_str = f"(avg ratio: {avg_ratio:.1f}x)"
        print(f"\n**Team Balance:** {balance_status} {ratio_str}")


def cmd_reverts(owner: str, repo: str, since: datetime) -> None:
    """Track reverts and hotfixes."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    revert_pattern = re.compile(r"\b(revert|rollback|undo)\b", re.IGNORECASE)
    hotfix_pattern = re.compile(
        r"\b(hotfix|hot-fix|emergency|urgent)\b", re.IGNORECASE
    )
    revert_ref_pattern = re.compile(r"reverts?\s+#(\d+)", re.IGNORECASE)

    reverts: list[dict] = []
    hotfixes: list[dict] = []

    for pr in prs:
        title = pr.get("title", "")
        body = pr.get("body", "") or ""

        is_revert = bool(revert_pattern.search(title))
        is_hotfix = bool(hotfix_pattern.search(title))

        original_pr = None
        title_match = revert_ref_pattern.search(title)
        body_match = revert_ref_pattern.search(body)
        ref_match = title_match or body_match
        if ref_match:
            original_pr = ref_match.group(1)

        pr_data = {
            "number": pr["number"],
            "title": pr["title"],
            "author": pr["user"]["login"],
            "merged_at": pr["merged_at"],
            "original_pr": original_pr,
        }

        if is_revert:
            reverts.append(pr_data)
        elif is_hotfix:
            hotfixes.append(pr_data)

    total_prs = len(prs)
    revert_count = len(reverts)
    hotfix_count = len(hotfixes)

    print("## Reverts & Hotfixes\n")
    print("### Summary\n")

    if total_prs > 0:
        revert_pct = (revert_count / total_prs) * 100
        hotfix_pct = (hotfix_count / total_prs) * 100
        rev_msg = f"- **Reverts:** {revert_count} ({revert_pct:.1f}%)"
        hot_msg = f"- **Hotfixes:** {hotfix_count} ({hotfix_pct:.1f}%)"
        print(rev_msg)
        print(hot_msg)
    else:
        print("- **Reverts:** 0")
        print("- **Hotfixes:** 0")

    if reverts or hotfixes:
        print("\n### Details\n")
        print("| PR | Type | Author | Original PR | Merged |")
        print("|----|------|--------|-------------|--------|")

        all_items = [
            (pr, "Revert") for pr in reverts
        ] + [
            (pr, "Hotfix") for pr in hotfixes
        ]

        all_items.sort(
            key=lambda x: x[0]["merged_at"],
            reverse=True,
        )

        for pr_data, pr_type in all_items:
            orig_pr = pr_data["original_pr"]
            original = f"#{orig_pr}" if orig_pr else "-"
            merged = format_date(pr_data["merged_at"])
            raw_title = pr_data["title"]
            title = raw_title[:30] + ("..." if len(raw_title) > 30 else "")
            print(
                f"| #{pr_data['number']} {title} | {pr_type} | "
                f"@{pr_data['author']} | {original} | {merged} |"
            )
    else:
        print("\n*No reverts or hotfixes found in this time range.*")


def cmd_review_depth(owner: str, repo: str, since: datetime) -> None:
    """Detect rubber stamp reviews vs thorough reviews."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    rubber_stamps: list[dict] = []
    prs_with_reviews = 0
    reviewer_stats: dict[str, dict] = defaultdict(
        lambda: {"review_times": [], "comment_counts": []}
    )

    for pr in prs:
        pr_number = pr["number"]
        created = parse_datetime(pr["created_at"])
        author = pr["user"]["login"]
        stats = get_pr_stats(owner, repo, pr_number)
        total_lines = stats["additions"] + stats["deletions"]

        reviews = fetch_pr_reviews(owner, repo, pr_number)
        comments = fetch_pr_comments(owner, repo, pr_number)

        if reviews:
            prs_with_reviews += 1

        for review in reviews:
            reviewer = review["user"]["login"]
            if reviewer == author:
                continue

            if not review.get("submitted_at"):
                continue

            review_time = parse_datetime(review["submitted_at"])
            time_to_review = review_time - created
            review_minutes = time_to_review.total_seconds() / 60

            reviewer_comments = sum(
                1 for c in comments if c["user"]["login"] == reviewer
            )

            reviewer_stats[reviewer]["review_times"].append(review_minutes)
            rev_stats = reviewer_stats[reviewer]
            rev_stats["comment_counts"].append(reviewer_comments)

            is_approval = review.get("state") == "APPROVED"
            is_quick = review_minutes < 5
            is_large = total_lines > 500
            no_comments = reviewer_comments == 0

            if is_approval and is_quick and (is_large or no_comments):
                rubber_stamps.append({
                    "number": pr_number,
                    "title": pr["title"],
                    "author": author,
                    "reviewer": reviewer,
                    "lines": total_lines,
                    "review_time": review_minutes,
                })

    total_reviewed = prs_with_reviews
    if total_reviewed == 0:
        print("No reviews found in the specified time range.")
        return

    rubber_count = len(rubber_stamps)
    thorough_pct = (
        (total_reviewed - rubber_count) / total_reviewed * 100
        if total_reviewed > 0 else 0
    )
    rubber_pct = 100 - thorough_pct

    print("## Review Depth Analysis\n")
    print("### Summary\n")
    print(f"- **Thorough Reviews:** {thorough_pct:.0f}%")
    print(f"- **Potential Rubber Stamps:** {rubber_pct:.0f}%")

    if rubber_stamps:
        print("\n### Potential Rubber Stamps\n")
        print("| PR | Author | Reviewer | Lines | Review Time |")
        print("|----|--------|----------|-------|-------------|")

        sorted_stamps = sorted(
            rubber_stamps,
            key=lambda x: x["lines"],
            reverse=True,
        )[:10]

        for rs in sorted_stamps:
            raw_title = rs["title"]
            title = raw_title[:25] + ("..." if len(raw_title) > 25 else "")
            print(
                f"| #{rs['number']} {title} | @{rs['author']} | "
                f"@{rs['reviewer']} | {rs['lines']:,} | "
                f"{rs['review_time']:.0f} min |"
            )

    if reviewer_stats:
        print("\n### Thorough Review Champions\n")
        print("| Reviewer | Avg Review Time | Comments/Review |")
        print("|----------|-----------------|-----------------|")

        champions: list[tuple[str, float, float]] = []
        for reviewer, data in reviewer_stats.items():
            if data["review_times"]:
                times = data["review_times"]
                avg_time = sum(times) / len(times)
                avg_comments = (
                    sum(data["comment_counts"]) / len(data["comment_counts"])
                )
                if avg_time >= 10 or avg_comments >= 1:
                    champions.append((reviewer, avg_time, avg_comments))

        champions.sort(key=lambda x: x[2], reverse=True)

        for reviewer, avg_time, avg_comments in champions[:5]:
            print(f"| @{reviewer} | {avg_time:.0f} min | {avg_comments:.1f} |")


def cmd_review_cycles(owner: str, repo: str, since: datetime) -> None:
    """Track rounds of feedback before merge."""
    prs = fetch_merged_prs(owner, repo, since)

    if not prs:
        print("No PRs merged in the specified time range.")
        return

    cycle_counts: dict[int, int] = defaultdict(int)
    pr_cycles: list[dict] = []

    for pr in prs:
        pr_number = pr["number"]
        author = pr["user"]["login"]
        reviews = fetch_pr_reviews(owner, repo, pr_number)

        if not reviews:
            cycle_counts[1] += 1
            continue

        sorted_reviews = sorted(
            [r for r in reviews if r.get("submitted_at")],
            key=lambda x: x["submitted_at"],
        )

        cycles = 1
        last_approver = None
        for review in sorted_reviews:
            reviewer = review["user"]["login"]
            if reviewer == author:
                continue

            state = review.get("state", "")
            if state == "CHANGES_REQUESTED":
                cycles += 1
                last_approver = None
            elif state == "APPROVED":
                last_approver = reviewer

        cycle_counts[cycles] += 1
        pr_cycles.append({
            "number": pr_number,
            "title": pr["title"],
            "author": author,
            "cycles": cycles,
            "final_reviewer": last_approver,
        })

    total_prs = len(prs)
    if total_prs == 0:
        print("No PRs found in the specified time range.")
        return

    print("## Review Cycles\n")
    print("### Summary\n")
    print("| Cycles | Count | Percentage |")
    print("|--------|-------|------------|")

    first_try = cycle_counts.get(1, 0)
    two_cycles = cycle_counts.get(2, 0)
    three_plus = sum(c for cyc, c in cycle_counts.items() if cyc >= 3)

    first_pct = (first_try / total_prs * 100) if total_prs > 0 else 0
    two_pct = (two_cycles / total_prs * 100) if total_prs > 0 else 0
    three_pct = (three_plus / total_prs * 100) if total_prs > 0 else 0

    print(f"| 1 (First try) | {first_try} | {first_pct:.0f}% |")
    print(f"| 2 | {two_cycles} | {two_pct:.0f}% |")
    print(f"| 3+ | {three_plus} | {three_pct:.0f}% |")

    high_cycle_prs = [p for p in pr_cycles if p["cycles"] >= 3]
    if high_cycle_prs:
        print("\n### PRs with Most Iterations\n")
        print("| PR | Author | Cycles | Final Reviewer |")
        print("|----|--------|--------|----------------|")

        sorted_prs = sorted(
            high_cycle_prs,
            key=lambda x: x["cycles"],
            reverse=True,
        )[:5]

        for pr_data in sorted_prs:
            raw_title = pr_data["title"]
            title = raw_title[:30] + ("..." if len(raw_title) > 30 else "")
            final_rev = pr_data["final_reviewer"]
            final = f"@{final_rev}" if final_rev else "-"
            print(
                f"| #{pr_data['number']} {title} | @{pr_data['author']} | "
                f"{pr_data['cycles']} | {final} |"
            )

    all_cycles = [p["cycles"] for p in pr_cycles]
    if all_cycles:
        avg_cycles = sum(all_cycles) / len(all_cycles)
        median_cycles = statistics.median(all_cycles)
        avg_str = f"**Avg Cycles:** {avg_cycles:.1f}"
        med_str = f"**Median:** {median_cycles:.0f}"
        print(f"\n{avg_str} | {med_str}")


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="GitHub team stats")
    parser.add_argument(
        "--action",
        choices=[
            "prs-merged", "leaderboard", "activity",
            "time-to-merge", "reviews", "pr-size",
            "first-review", "review-balance", "reverts",
            "review-depth", "review-cycles",
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
    elif args.action == "first-review":
        cmd_first_review(owner, repo, since)
    elif args.action == "review-balance":
        cmd_review_balance(owner, repo, since)
    elif args.action == "reverts":
        cmd_reverts(owner, repo, since)
    elif args.action == "review-depth":
        cmd_review_depth(owner, repo, since)
    elif args.action == "review-cycles":
        cmd_review_cycles(owner, repo, since)


if __name__ == "__main__":
    main()
