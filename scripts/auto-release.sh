#!/bin/bash

# Automatic Release trigger script
# Auto-determine if release should be created based on commit message

set -e

# Get latest commit message
LATEST_COMMIT=$(git log -1 --pretty=format:"%s")

echo "Checking latest commit: $LATEST_COMMIT"

# Check if commit should trigger release
should_release() {
    local commit_msg="$1"

    # Check if contains release trigger keywords
    if [[ $commit_msg =~ ^(feat|fix|perf|refactor)(\(.+\))?!?: ]]; then
        return 0  # Should create release
    fi

    # Check if explicitly marked for release
    if [[ $commit_msg =~ \[release\] ]]; then
        return 0  # Should create release
    fi

    # Check if breaking change
    if [[ $commit_msg =~ BREAKING[[:space:]]CHANGE ]]; then
        return 0  # Should create release
    fi

    return 1  # Should not create release
}

# Determine version type
get_version_type() {
    local commit_msg="$1"

    if [[ $commit_msg =~ BREAKING[[:space:]]CHANGE ]] || [[ $commit_msg =~ ^[^:]+!: ]]; then
        echo "major"
    elif [[ $commit_msg =~ ^feat ]]; then
        echo "minor"
    elif [[ $commit_msg =~ ^(fix|perf|refactor) ]]; then
        echo "patch"
    else
        echo "patch"
    fi
}

# Calculate new version number
calculate_version() {
    local version_type="$1"
    local current_version=$(git tag -l | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 | sed 's/^v//')

    if [ -z "$current_version" ]; then
        echo "1.0.0"
        return
    fi

    IFS='.' read -ra PARTS <<< "$current_version"
    local major=${PARTS[0]}
    local minor=${PARTS[1]}
    local patch=${PARTS[2]}

    case $version_type in
        "major")
            echo "$((major + 1)).0.0"
            ;;
        "minor")
            echo "$major.$((minor + 1)).0"
            ;;
        "patch")
            echo "$major.$minor.$((patch + 1))"
            ;;
        *)
            echo "$major.$minor.$((patch + 1))"
            ;;
    esac
}

# Main logic
if should_release "$LATEST_COMMIT"; then
    VERSION_TYPE=$(get_version_type "$LATEST_COMMIT")
    NEW_VERSION=$(calculate_version "$VERSION_TYPE")

    echo "🚀 Triggering automatic release:"
    echo "   Commit: $LATEST_COMMIT"
    echo "   Type: $VERSION_TYPE"
    echo "   Version: $NEW_VERSION"

    # Call release creation script
    ./scripts/create-release.sh "$NEW_VERSION"
else
    echo "ℹ️  Current commit does not trigger release"
    echo "   Trigger conditions: feat:, fix:, perf:, refactor:, [release], BREAKING CHANGE"
fi
