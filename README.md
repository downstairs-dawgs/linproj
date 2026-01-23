# linproj

CLI for Linear.

## Install

**macOS (Apple Silicon):**
```bash
curl -fsSL https://github.com/downstairs-dawgs/linproj/releases/latest/download/linproj-darwin-arm64 -o /usr/local/bin/linproj && chmod +x /usr/local/bin/linproj
```

**Linux (x64):**
```bash
curl -fsSL https://github.com/downstairs-dawgs/linproj/releases/latest/download/linproj-linux-amd64 -o /usr/local/bin/linproj && chmod +x /usr/local/bin/linproj
```

**Linux (ARM64):**
```bash
curl -fsSL https://github.com/downstairs-dawgs/linproj/releases/latest/download/linproj-linux-arm64 -o /usr/local/bin/linproj && chmod +x /usr/local/bin/linproj
```

Or build from source:
```bash
bun install && bun run build
./build/linproj --help
```

## Usage

```bash
# Authenticate with Linear (API key)
linproj auth login

# Check auth status
linproj auth status

# List your assigned issues
linproj issues list

# Create an issue
linproj issues create --title "Fix bug" --assign-to-me

# Logout
linproj auth logout
```

## Development

```bash
bun install
bun run src/index.ts --help
```
