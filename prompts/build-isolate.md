---
description: Generate sandboxed pi launch script using Sandbox (macOS) or bubblewrap (Linux). Output bash script to $1.
model: openrouter/openai/gpt-5.6-luna
thinking: medium
deterministic:
  run: uname -s
  handoff: always
---
# Build Isolate: $1

Build a bash script that launches pi inside a sandbox (Sandbox on macOS, bubblewrap on Linux).

## Args
- $1: output directory for the bash script

## Workflow

### Phase 1: Detect OS
The deterministic step above tells us the OS. If macOS → use `sandbox-exec`. If Linux → use `bubblewrap`.

### Phase 2: Gather pi dependencies
Run these discovery commands to find what pi needs:

```
# Find pi binary/link
which pi 2>/dev/null || echo "pi not in PATH"
# Find node
which node 2>/dev/null || echo "node not in PATH"
# Find pi agent dir
echo "$PI_CODING_AGENT_DIR"
# Find npm global prefix
npm prefix -g 2>/dev/null || echo "no global prefix"
```

### Phase 3: Build the sandbox script

#### macOS (sandbox-exec) version
The script should:
1. Accept workspace path as first argument
2. Build a sandbox profile (.sb) that allows:
   - Read/Write access to the workspace path
   - Read access to pi agent directory ($HOME/.pi/agent)
   - Read access to node and npm global modules
   - Network access (for API calls, git operations)
   - Read access to system libraries (/usr/lib, /System/Library)
   - Execute access for node, bash, git
   - Write access to temp directories
   - Process creation for child processes
   - Signal handling for subagent management
3. **Block access** to:
   - ~/.ssh (SSH keys)
   - Sensitive env vars (AWS_KEYS, GITHUB_TOKEN, etc.)
   - ~/Documents, ~/Desktop, ~/Downloads broadly (only workspace allowed)
   - Keychain access
4. Launch pi with `PI_CODING_AGENT_DIR` pointed at the agent config
5. Pass workspace path as the initial working directory

#### Linux (bubblewrap) version
The script should:
1. Accept workspace path as first argument
2. Build a bwrap command that:
   - Binds workspace path read-write
   - Binds pi agent directory read-only
   - Binds node and npm modules read-only
   - Binds system libraries read-only (/usr, /lib, /lib64)
   - Provides network access (--share-net)
   - Mounts tmpfs on /tmp
   - Creates minimal /dev
3. **Block access** to:
   - $HOME/.ssh
   - $HOME/.aws, $HOME/.config/gcloud etc
   - /home broad access (only workspace and pi agent)
4. Launch pi inside the sandbox

### Phase 4: Write the script
Write the sandbox script to `$1/pi-sandbox.sh`
Make it executable.
The script must be self-contained with the sandbox profile embedded.

### Phase 5: Report
Output a summary:
```
Sandbox script written to: $1/pi-sandbox.sh
OS: [macOS/Linux]
Usage: ./pi-sandbox.sh /path/to/workspace
```
## Constraints
- Do not leak SSH keys, home directory contents, or sensitive env vars
- The sandbox must allow pi to function: install packages, run tests, read/write workspace
- The sandbox must block everything outside the workspace + pi dependencies
- If `sandbox-exec` or `bwrap` are not installed, note it in the output
