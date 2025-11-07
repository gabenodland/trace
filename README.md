# Trace

A cross-platform application built with React, React Native, and Supabase.

## Project Structure

This is a monorepo containing:
- `apps/web` - React web application
- `apps/mobile` - React Native mobile application
- `packages/core` - Shared business logic and utilities

## Getting Started

### Prerequisites
- Node.js 18+
- npm 8+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/gabenodland/trace.git
cd trace
```

2. Install dependencies:
```bash
npm install
```

3. Configure Supabase:
```bash
cp packages/core/config.example.json packages/core/config.json
# Edit config.json with your Supabase credentials
```

4. Build the core package:
```bash
npm run build:shared
```

### Development

Run the web app:
```bash
npm run dev:web
```

Run the mobile app:
```bash
npm run dev:mobile
```

Run both:
```bash
npm run dev:all
```

## Tech Stack

- **Frontend:** React 19, React Native 0.81
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Data Management:** TanStack Query (React Query)
- **Language:** TypeScript
- **Build Tools:** Vite (web), Expo (mobile)

## Architecture

This project follows a module-first architecture with:
- Centralized business logic in the core package
- Shared types and utilities
- Platform-specific UI implementations
- Single source of truth for data management

See [CLAUDE.md](./CLAUDE.md) for detailed architecture guidelines.