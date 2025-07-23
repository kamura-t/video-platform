# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The GVA Video Platform is an enterprise-grade video sharing and management system built with Next.js 15 and TypeScript. It serves as a comprehensive solution for organizations to manage, share, and distribute video content with advanced features including GPU-accelerated transcoding, multi-role access control, and real-time analytics.

## Development Commands

### Essential Commands
```bash
# Development
npm run dev                  # Start development server (http://localhost:3000)
npm run build               # Build for production
npm start                   # Start production server
npm run type-check          # TypeScript type checking
npm run lint                # ESLint code linting

# Database Operations
npm run db:generate         # Generate Prisma client
npm run db:push            # Push schema to database
npm run db:seed            # Seed database with initial data
npm run db:studio          # Open Prisma Studio
npm run db:reset           # Reset database
```

### Development Workflow
1. **Setup**: Install dependencies (`npm install`)
2. **Database**: Configure PostgreSQL and run migrations
3. **Environment**: Copy `env.example` to `.env.local` and configure
4. **Development**: Start with `npm run dev`
5. **Testing**: Use `npm run type-check` and `npm run lint`

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **State Management**: Zustand + Context Providers
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + Cookie-based sessions
- **Video Processing**: GPU transcoding server integration (AV1)
- **File Storage**: NAS integration for scalability

### Core Architecture Patterns

**Component Organization**:
- **Layout Components**: `MainLayout`, `Header` for structure
- **Video Components**: `VideoGrid`, `VideoCard`, `VideoPlayer`
- **Admin Components**: Role-based management interfaces
- **UI Components**: Shadcn/ui library with custom extensions

**Data Flow**:
1. **Authentication**: JWT tokens with role-based access (ADMIN/CURATOR/VIEWER)
2. **Video Upload**: File upload → Validation → GPU transcoding → Storage
3. **Content Management**: Categories, tags, playlists with many-to-many relationships
4. **Real-time Features**: Progress tracking, live updates

### Database Schema (Prisma)

**Core Models**:
- `User`: Multi-role system with profile management
- `Video`: Supports file uploads and YouTube links
- `Post`: Unified posting system
- `Category/Tag`: Content organization
- `Playlist`: Video collections with ordering
- `TranscodeJob`: GPU server integration

**Key Features**:
- Comprehensive indexing for performance
- Audit trails with created/updated timestamps
- Visibility controls (PUBLIC/PRIVATE/DRAFT)
- View tracking and analytics

## API Design

### Authentication & Users
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/me` - Current user information
- `GET /api/users` - User management

### Video Management
- `GET /api/videos` - Video listing with filtering, sorting, pagination
- `GET /api/videos/[id]` - Individual video details
- `POST /api/upload` - File upload and YouTube URL processing
- `POST /api/transcode` - GPU transcoding job management

### Content Organization
- `GET /api/categories` - Category management
- `GET /api/tags` - Tag management
- `GET /api/playlists` - Playlist CRUD operations

### Admin Features
- `GET /api/admin/settings` - System configuration
- `GET /api/admin/stats` - Analytics and statistics
- `POST /api/admin/users` - User administration

## Key Features

### Video Processing Pipeline
1. **Upload**: File upload or YouTube URL input
2. **Validation**: Format verification and metadata extraction
3. **Transcoding**: GPU-accelerated AV1 conversion
4. **Storage**: NAS storage with CDN integration
5. **Optimization**: Thumbnail generation and quality analysis

### User Experience
- Responsive design (mobile-first with extensive breakpoints)
- Dark/light theme support
- Advanced search and filtering
- Infinite scroll pagination
- Recommendation system based on viewing history

### Administrative Capabilities
- Multi-role permission system
- Drag-and-drop category management
- System settings configuration
- Analytics dashboard with view tracking
- Content moderation tools

## Development Patterns

### Component Development
- **TypeScript First**: Strict typing throughout
- **Composition Pattern**: Reusable components with clear interfaces
- **Provider Pattern**: Context providers for global state
- **Custom Hooks**: Shared logic extraction

### State Management
- **Zustand**: Lightweight state management
- **Context Providers**: Auth, Settings, Categories, Theme
- **Local State**: React hooks for component-specific state

### Error Handling
- **Unified API Responses**: `lib/api-response.ts` for consistent formatting
- **Input Validation**: Zod schemas for runtime validation
- **Error Boundaries**: React error boundaries for graceful failures

### Performance Optimizations
- **Infinite Scroll**: Efficient pagination with `useInfiniteScroll`
- **Image Optimization**: Sharp for server-side processing
- **Database Indexing**: Strategic indexes for query performance
- **Caching**: Redis for session and metadata caching

## Configuration

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/gva_video
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# GPU Server
GPU_SERVER_URL=http://172.16.1.172:3001
NAS_BASE_URL=http://172.16.2.7

# File Storage
UPLOAD_DIR=/path/to/uploads
MAX_FILE_SIZE=10737418240  # 10GB
```

### Security Configuration
- **CORS**: Configured for allowed origins
- **IP Access Control**: Private network restrictions
- **Rate Limiting**: Request throttling
- **Content Security Policy**: XSS protection

## Integration Points

### GPU Transcoding Server
- **Endpoint**: `172.16.1.172:3001`
- **Purpose**: AV1 hardware-accelerated transcoding
- **Features**: Progress tracking, quality analysis, thumbnail generation

### NAS Storage
- **Endpoint**: `172.16.2.7`
- **Purpose**: Scalable file storage
- **Features**: Automated backup, CDN integration

### External Services
- **YouTube API**: Video metadata retrieval
- **Google Translate**: Multi-language support

## Common Development Tasks

### Adding New Video Features
1. Update Prisma schema if database changes needed
2. Create API endpoints in `/app/api`
3. Implement frontend components
4. Add proper error handling and validation
5. Update types in `/types`

### Role-Based Feature Development
1. Check user permissions in API routes
2. Implement UI conditional rendering
3. Add proper error messages for unauthorized access
4. Test with different user roles

### Performance Optimization
1. Use database indexes for new queries
2. Implement proper caching strategies
3. Optimize image/video processing
4. Monitor GPU transcoding performance

## Troubleshooting

### Common Issues
- **Database Connection**: Check PostgreSQL service and credentials
- **GPU Server**: Verify server accessibility and NVENC support
- **File Upload**: Check upload limits and disk space
- **Authentication**: Verify JWT secrets and session configuration

### Performance Issues
- **Slow Queries**: Check database indexes and query optimization
- **Memory Usage**: Monitor transcoding job queue
- **Network Latency**: Implement proper caching strategies

This platform represents a production-ready enterprise video management system with comprehensive features for content creation, management, and distribution, built with modern web technologies and optimized for performance and scalability.