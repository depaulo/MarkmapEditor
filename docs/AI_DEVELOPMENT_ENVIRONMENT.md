DEVELOPMENT ENVIRONMENT

This repository is being developed in native Termux on Android (aarch64), without proot.

Before using shell tooling, follow "docs/AI_DEVELOPMENT_ENVIRONMENT.md".

Important:

- Prefer the documented verified command set.
- Prefer "rg" for search, "sed" for targeted inspection, and "git diff" / "git status" for change verification.
- Do not assume standard "/bin" or "/usr/bin" Linux paths; use commands through "PATH".
- Before relying on an undocumented command, check it with "command -v".
- Do not install packages unless explicitly authorized.
- A malformed "execute_command" tool call is an agent/tool-call error, not evidence that Termux lacks the command.

MarkmapEditor — AI Development Environment

Purpose

This document describes the development environment used for AI-assisted work on MarkmapEditor.

AI coding agents must account for this environment before assuming that commands, paths, binaries, or Linux-specific tooling are available.

This document describes the environment only. It does not define feature architecture or authorize changes to repository files.

---

1. Platform

Primary development environment:

- Android
- Samsung Galaxy S22
- ARM64 / aarch64
- Native Termux
- No proot Linux distribution
- DeX used as the desktop environment
- VSCodium used as the primary editor
- AI coding agents may operate through VSCodium extensions such as Cline/Roo Code

Observed system:

Linux localhost 5.10.236-android12-9-31998796-abS901EXXSEGZE3
Architecture: aarch64
Platform: Android

Termux prefix:

/data/data/com.termux/files/usr

Shell:

/data/data/com.termux/files/usr/bin/zsh

This is NOT a conventional desktop/server GNU/Linux filesystem.

Agents must not assume that "/usr/bin", "/bin", "/home", systemd, sudo, apt, or other conventional Linux facilities behave as they would on Ubuntu/Debian.

---

2. Verified Core Development Commands

The following commands have been explicitly verified as available.

Shell and repository tools

sh
bash
git
rg
grep
sed
awk
find
xargs

Text and file inspection

cat
head
tail
sort
uniq
cut
tr
wc
file

Diff and patch tools

diff
patch

Structured data and network

jq
curl

JavaScript

node
npm
npx

Python

python
python3

Compilation/build

make
clang
gcc

Path utilities

realpath
readlink
dirname
basename
stat

Filesystem operations

touch
mkdir
cp
mv
rm

Archives

tar
gzip
unzip

---

3. Commands Known To Be Missing

The following commands were tested and were not installed at the time this document was created:

wget
tree

Do not rely on them without checking again.

Alternatives:

curl
find

For example, instead of "tree", use an appropriately bounded "find" command.

---

4. Verified Versions

At the time of environment verification:

GNU bash 5.3.9
git 2.55.0
ripgrep 15.2.0
GNU grep 3.12
GNU sed 4.9
GNU Awk 5.3.2
GNU findutils 4.10.0
GNU diffutils 3.12
GNU patch 2.8
jq 1.8.2
Node.js v26.4.0
npm 11.18.0
Python 3.14.6

Versions may change after Termux package updates.

Agents should depend on capabilities rather than unnecessarily requiring these exact versions.

---

5. Command Availability Rule

Before relying on a command not listed as verified in this document, check whether it exists.

Preferred test:

command -v COMMAND

Example:

command -v perl

For several commands:

for cmd in COMMAND1 COMMAND2 COMMAND3; do
  command -v "$cmd" || echo "MISSING: $cmd"
done

Do not interpret a failed AI tool invocation as proof that the underlying shell command is unavailable.

For example, an agent error such as:

execute_command without value for required parameter 'command'

is an AI/tool-call construction failure.

It says nothing about Termux command availability.

---

6. Preferred Repository Investigation Tools

Prefer simple, already-verified tools.

Search repository

Preferred:

rg -n "pattern" path

With surrounding context:

rg -n -C 8 "pattern" path

Search selected files:

rg -n "pattern" js/main.js js/workspace/workspace-parser.js

---

Inspect a specific source range

Preferred:

sed -n 'START,ENDp' file

Example:

sed -n '1628,1685p' js/main.js

Avoid dumping entire large files when only a small section is relevant.

---

Find files

Preferred:

find . -type f

Use appropriate path and depth restrictions when possible.

---

Inspect modifications

Preferred:

git status --short
git diff -- file
git diff --stat

Before editing, determine whether the working tree already contains unrelated changes.

Never assume every existing modification belongs to the current task.

---

7. Editing Rules for AI Agents

Agents should make focused edits rather than rewriting complete files.

Before editing:

1. Locate the relevant symbol with "rg".
2. Inspect surrounding code with "sed".
3. Understand the existing control/data flow.
4. Confirm the file is inside the approved task scope.
5. Make the smallest justified modification.
6. Inspect the resulting diff.

After editing:

git diff -- path/to/file

If several files were changed:

git status --short
git diff --stat

Do not modify unrelated existing user changes.

---

8. Package Installation

Do NOT automatically install packages because a preferred command is unavailable.

First:

1. Check whether the command exists.
2. Determine whether an already-installed tool can perform the operation.
3. Prefer the existing tool when practical.
4. Request authorization before installing additional packages if installation is actually necessary.

Example:

If "wget" is unavailable, use "curl" when suitable instead of immediately installing "wget".

---

9. Path Assumptions

Termux paths differ from conventional Linux distributions.

Important prefix:

/data/data/com.termux/files/usr

User files may also appear through Termux storage paths such as:

~/storage/downloads/

Do not hardcode conventional paths such as:

/usr/bin/
/home/user/
/bin/

unless their existence has explicitly been verified.

Prefer commands resolved through "PATH".

Example:

rg

instead of:

/usr/bin/rg

---

10. Resource Constraints

Development occurs on a mobile device.

Agents should avoid unnecessarily expensive operations.

Prefer:

- targeted "rg" searches
- bounded "sed" inspection
- incremental investigation
- small diffs
- focused tests

Avoid when unnecessary:

- repeatedly scanning the entire repository
- dumping very large files into model context
- large recursive operations
- unnecessary dependency installations
- repeated build/test cycles that provide no new diagnostic information

Investigation should progressively narrow the search space.

---

11. AI Context Efficiency

The environment is also used with models where context and inference resources may be limited.

Agents should therefore avoid feeding large amounts of irrelevant terminal output back into the model.

Preferred sequence:

search
  ↓
identify relevant symbol
  ↓
inspect small source range
  ↓
form hypothesis
  ↓
inspect supporting code
  ↓
edit if justified
  ↓
inspect diff
  ↓
test

Do not repeatedly read an entire source file when targeted inspection is sufficient.

---

12. Tool Failure Classification

When something fails, distinguish among:

A. Command unavailable

Example:

command not found

Verify with:

command -v COMMAND

B. Command returned an error

The binary exists but its arguments, paths, permissions, or environment caused failure.

Investigate the actual stderr/output.

C. AI tool-call failure

Example:

execute_command without value for required parameter 'command'

This means the agent generated an invalid tool request.

Retry with a valid command.

Do not modify the repository or install software merely because the AI generated a malformed tool invocation.

D. Model/provider failure

Examples include:

429 Too Many Requests
RESOURCE_EXHAUSTED
quota exceeded

These are model/API/provider failures and are unrelated to the repository or Termux command availability.

Wait for the provider limit to reset, reduce request size, or change model/provider as appropriate.

---

13. General Rule

When uncertain about the environment:

Inspect first. Do not assume.

A short capability check is preferable to introducing dependencies or changing implementation strategy based on assumptions about native Termux.

---

14. AI Development Workflow

This document defines the execution environment only.

All AI coding work must also follow:

docs/AI_DEVELOPMENT_WORKFLOW.md

That document defines:

- mandatory PLAN → review → ACT separation;
- same-conversation continuity;
- incremental instructions;
- new-conversation conditions;
- repository safety;
- file ownership;
- editing constraints;
- tool lifecycle;
- validation;
- final reporting.

If the two documents appear to conflict:

- environment and command availability are governed by
  AI_DEVELOPMENT_ENVIRONMENT.md;
- development process and implementation authorization are governed by
  AI_DEVELOPMENT_WORKFLOW.md.
