# linproj

CLI for Linear.

## Install

Download the binary from releases, or build from source:

```bash
bun install
bun run build
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

# Logout
linproj auth logout
```

## Development

```bash
bun install
bun run src/index.ts --help
```
