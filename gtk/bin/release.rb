#!/usr/bin/env ruby
# frozen_string_literal: true

# Kaya Release Script
# Automates the Flathub release process:
#   Step 1: Determine and confirm new version
#   Step 2: Update version in all source files
#   Step 3: Commit, push, tag, push tags
#   Step 4: Update ca.deobald.Kaya.json branch, commit, push

require "json"
require "date"

ROOT = File.expand_path("..", __dir__)

def run(cmd)
  output = `cd #{ROOT} && #{cmd} 2>&1`.strip
  unless $?.success?
    abort "Command failed: #{cmd}\n#{output}"
  end
  output
end

def prompt(message)
  print message
  $stdin.gets.chomp
end

def confirm(message)
  print "#{message} [Y/n] "
  answer = $stdin.gets.chomp
  abort "Aborted." unless answer.empty? || answer.downcase == "y"
end

# --- Step 1: Determine new version ---

puts "=== Step 1: Determine new version ==="
puts

tags = run("git tag --sort=-v:refname").lines.map(&:strip).select { |t| t.match?(/^v\d+\.\d+\.\d+$/) }

if tags.empty?
  abort "No version tags found (expected format: vX.Y.Z)"
end

current_tag = tags.first
current_version = current_tag.sub(/^v/, "")
major, minor, patch = current_version.split(".").map(&:to_i)
suggested_version = "#{major}.#{minor}.#{patch + 1}"

puts "Current version: #{current_version} (#{current_tag})"
puts "Suggested version: #{suggested_version}"
puts

input = prompt("New version [#{suggested_version}]: ")
new_version = input.empty? ? suggested_version : input

unless new_version.match?(/^\d+\.\d+\.\d+$/)
  abort "Invalid version format: #{new_version} (expected X.Y.Z)"
end

new_tag = "v#{new_version}"
today = Date.today.to_s

puts
puts "Will release: #{new_version} (#{new_tag})"
confirm("Proceed?")

# --- Step 2: Update version in source files ---

puts
puts "=== Step 2: Update version in source files ==="
puts

# package.json
package_json_path = File.join(ROOT, "package.json")
package_json = JSON.parse(File.read(package_json_path))
package_json["version"] = new_version
File.write(package_json_path, JSON.pretty_generate(package_json) + "\n")
puts "  Updated package.json"

# meson.build
meson_path = File.join(ROOT, "meson.build")
meson = File.read(meson_path)
meson.sub!(/version:\s*'[^']*'/, "version: '#{new_version}'")
File.write(meson_path, meson)
puts "  Updated meson.build"

# data/ca.deobald.Kaya.metainfo.xml.in
metainfo_path = File.join(ROOT, "data", "ca.deobald.Kaya.metainfo.xml.in")
metainfo = File.read(metainfo_path)
metainfo.sub!(/<release version="[^"]*" date="[^"]*"/, "<release version=\"#{new_version}\" date=\"#{today}\"")
File.write(metainfo_path, metainfo)
puts "  Updated data/ca.deobald.Kaya.metainfo.xml.in"

# src/main.ts
main_ts_path = File.join(ROOT, "src", "main.ts")
main_ts = File.read(main_ts_path)
main_ts.sub!(/version:\s*"[^"]*"/, "version: \"#{new_version}\"")
File.write(main_ts_path, main_ts)
puts "  Updated src/main.ts"

puts
puts run("cd #{ROOT} && git diff")
puts

confirm("Diffs look correct?")

# --- Step 3: Commit, push, tag, push tags ---

puts
puts "=== Step 3: Commit, tag, and push ==="
puts

run("git add .")
run("git commit -m 'cut a new version: #{new_version}'")
puts "  Committed: cut a new version: #{new_version}"

confirm("Push?")
run("git push")
puts "  Pushed to remote"

run("git tag -a #{new_tag} -m 'Release #{new_tag}'")
puts "  Tagged: #{new_tag}"

confirm("Push tags?")
run("git push --tags")
puts "  Pushed tags"

# --- Step 4: Update ca.deobald.Kaya.json branch and commit ---

puts
puts "=== Step 4: Update ca.deobald.Kaya.json ==="
puts

manifest_path = File.join(ROOT, "ca.deobald.Kaya.json")
manifest = JSON.parse(File.read(manifest_path))

git_source = manifest["modules"][0]["sources"].find { |s| s["type"] == "git" }
if git_source
  commit_hash = run("git rev-parse HEAD")
  git_source["branch"] = new_tag
  git_source["commit"] = commit_hash
  File.write(manifest_path, JSON.pretty_generate(manifest) + "\n")
  puts "  Updated ca.deobald.Kaya.json:"
  puts "    branch: #{new_tag}"
  puts "    commit: #{commit_hash}"
else
  abort "Could not find git source in ca.deobald.Kaya.json"
end

puts
puts run("cd #{ROOT} && git diff")
puts

confirm("Manifest diff looks correct?")

run("git add #{manifest_path}")
run("git commit -m 'bump release version in manifest'")
puts "  Committed manifest update"

confirm("Push manifest?")

run("git push")
puts "  Pushed to remote"

puts
puts "=== Release #{new_version} complete ==="
