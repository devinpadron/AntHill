#!/bin/bash

# Usage: ./run.sh [ios|android]
# This script will delete the node_modules, package-lock.json, ios, android, and .expo directories, 
# then run npm install, npx expo prebuild, and npx expo run with the specified platform (ios or android).

set -e  # Exit on error

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Function to delete a directory or file
delete_path() {
	if [ -e "$1" ]; then
		rm -rf "$1"
		echo "Deleted: $1"
	else
		echo "Path does not exist: $1"
	fi
}

# Get platform from command line arguments
PLATFORM="${1:-}"

# Validate platform
if [ ! -z "$PLATFORM" ] && [ "$PLATFORM" != "ios" ] && [ "$PLATFORM" != "android" ]; then
	echo "Invalid platform. Please specify 'ios', 'android', or leave it blank."
	exit 1
fi

# Delete directories
echo "Cleaning up old builds..."
delete_path "$SCRIPT_DIR/node_modules"
delete_path "$SCRIPT_DIR/package-lock.json"
delete_path "$SCRIPT_DIR/ios"
delete_path "$SCRIPT_DIR/android"
delete_path "$SCRIPT_DIR/.expo"

# Run npm install
echo "Running: npm install"
npm install

# Run npx expo prebuild
echo "Running: npx expo prebuild"
npx expo prebuild

# Run npx expo run with optional platform
if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "android" ]; then
	echo "Running: npx expo run:$PLATFORM"
	npx expo "run:$PLATFORM"
else
	echo "Running: npx expo run"
	npx expo run
fi

echo "Build complete!"
