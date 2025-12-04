# Proxmox Multi-Tenant Platform - Migration Plan
## From PHP/Vanilla JS to React + TypeScript

**Created**: December 4, 2025
**Target VM**: 192.168.142.237
**GitHub Repository**: https://github.com/carloscarluccio-sketch/multpanelreact.git

---

## Executive Summary

This document outlines the comprehensive plan to migrate the Proxmox Multi-Tenant Platform from a PHP backend with vanilla JavaScript frontend to a modern stack using:
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: MySQL/MariaDB (existing schema)
- **Authentication**: JWT with httpOnly cookies
- **API**: RESTful with OpenAPI/Swagger documentation

---

## Current System Analysis

### Architecture Overview
**Current Stack:**
- Backend: PHP 8.3
- Frontend: Vanilla JavaScript (ES6+), HTML5, CSS3
- Database: MySQL/MariaDB
- Server: Apache 2.4.58 on Ubuntu
- Authentication: JWT (JSON Web Tokens)

### Core Features Implemented

#### 1. **Multi-Tenant Management**
- Company isolation with role-based access control
- 4 user roles: super_admin, company_admin, salesperson, user
- Company-specific resource quotas and limits

#### 2. **Virtual Machine Management**
- Full VM lifecycle: create, start, stop, restart, delete
- Project-based VM organization
- Template management and quick deployment
- ESXi import wizard for VM migration
- Bulk operations and mark-for-deletion workflow
- VM analytics and metrics collection

####

 3. **Authentication & Security** (Recently Enhanced)
- JWT access tokens (15 min) + refresh tokens (7 days)
- httpOnly cookie storage for XSS protection
- Secure JWT pattern: always fetch user from database
- Rate limiting on auth endpoints
- 2FA support (TOTP-based)
- CSRF protection
- Session management with device tracking
- Comprehensive audit logging

#### 4. **Network Management**
- IP range allocation (CIDR notation)
- VLAN configuration per company/project
- Internal and external IP management
- Static IP assignment to VMs
- NAT rule management
- Gateway and netmask configuration

#### 5. **OPNsense Firewall Automation**
- Template-based OPNsense deployment
- Automatic VLAN assignment (100 + company_id + project_id)
- Pre-configured config.xml generation
- Secure password generation and storage
- Zero-touch installation process
- WAN + LAN multi-interface setup
- Service auto-configuration (NAT, DHCP, firewall rules)

#### 6. **Disaster Recovery (DR)**
- DR cluster pairing
- VM replication configuration
- Real-time sync status monitoring
- Failover automation
- DR dashboard with health metrics
- Replication history and audit trail

#### 7. **Cluster Management**
- Multiple Proxmox cluster support
- On-demand version fetching (no timeout issues)
- Node management
- Storage management
- Company-cluster assignments
- ISO management and download
- Template storage and deployment

#### 8. **User Management**
- Role-based access control (RBAC)
- Permission profiles
- Company-specific users
- Single Sign-On (SSO) integration
  - Microsoft Azure AD / Office 365
  - OAuth 2.0 / OpenID Connect
  - Auto-provisioning on first login
  - Domain-based company matching

#### 9. **Billing & Usage Tracking**
- Resource usage monitoring
- VM metrics collection (CPU, RAM, storage)
- Usage reports and trends
- Export functionality
- Billing information management

#### 10. **Activity Tracking**
- Comprehensive activity logging
- Real-time activity timeline
- Filter by type, status, entity
- Tracks: auth events, SSL generation, Apache config, VM ops
- JSON metadata storage
- Role-based activity filtering

#### 11. **SSL Certificate Management**
- Automated Let's Encrypt certificate generation
- Manual SSL certificate upload
- SSL status tracking
- Apache virtual host auto-generation
- HTTP to HTTPS redirection
- Certificate renewal tracking

#### 12. **URL Mapping & Branding**
- Custom URL mapping per company
- Company-specific branding:
  - Custom logo upload
  - Color scheme (primary, secondary, accent)
  - Custom panel name
- SSL configuration per mapping

#### 13. **Content Management**
- Articles system with targeted delivery
- Target audiences: everyone, cluster, company, company_role
- Active/inactive status
- Rich content editor
- Visibility rules based on targeting

#### 14. **Feedback System**
- User feedback submission
- Ticket-style management
- Reply system for admins
- Status tracking (open, in_progress, closed)
- Company-specific feedback filtering

#### 15. **Import & Discovery**
- VM discovery from Proxmox clusters
- Bulk import with metadata extraction
- Company reassignment
- Duplicate prevention
- Template filtering
- Network sync integration

---

## Database Schema Analysis

### Core Tables (18 primary tables)

**companies** - Multi-tenant isolation, company details
**users** - Authentication, role assignment, company association
**proxmox_clusters** - Cluster connection details, API credentials
**virtual_machines** - VM metadata, resource specs, project assignments
**vm_projects** - Project organization

### Network Tables (3 tables)
**ip_ranges** - Subnet allocation (CIDR), gateway config, VLAN
**vm_ip_assignments** - IP assignments to VMs, type distinction
**nat_rules** - NAT port forwarding, external to internal mapping

### OPNsense Tables (3 tables)
**opnsense_templates** - Reusable configurations
**opnsense_instances** - Deployed firewalls, config_xml storage
**opnsense_firewall_rules** - Custom rules per instance

### DR Tables (4 tables)
**dr_cluster_pairs** - Primary/DR cluster relationships
**dr_vm_policies** - RPO/RTO configuration
**dr_replicated_vms** - Replication status
**dr_failover_events** - Failover history

### Security & Auth Tables (6 tables)
**api_tokens** - API token management
**company_sso_config** - SSO configuration per company
**sso_login_audit** - SSO login tracking
**user_sessions** - Active sessions with device info
**rate_limit_log** - Rate limiting tracking
**activity_logs** - Comprehensive activity tracking

### Additional Tables
**permission_profiles** - Custom permission sets
**company_url_mappings** - URL mapping & branding
**articles** - Content management
**feedback** - User feedback system
**vm_resource_metrics** - Analytics data
**company_clusters** - Cluster assignments
**billing_info** - Billing data

**Total**: ~35+ tables with complex relationships

---

## Technology Stack Comparison

### Current (PHP)
| Component | Technology |
|-----------|------------|
| Backend | PHP 8.3 |
| Frontend | Vanilla JS (ES6+) |
| Build | None (direct file serving) |
| Type Safety | None |
| API Docs | Manual |
| Testing | Manual |
| Deployment | Apache + mod_php |

### Target (Modern Stack)
| Component | Technology |
|-----------|------------|
| Backend | Node.js 20 + Express + TypeScript |
| Frontend | React 18 + TypeScript + Vite |
| State Management | Zustand / Redux Toolkit |
| UI Components | Material-UI (MUI) / Ant Design |
| Forms | React Hook Form + Zod validation |
| API Client | Axios with interceptors |
| Build | Vite (fast HMR) |
| Type Safety | TypeScript (strict mode) |
| API Docs | Swagger/OpenAPI 3.0 |
| Testing | Jest + React Testing Library + Playwright |
| Deployment | PM2 + Nginx reverse proxy |
| Code Quality | ESLint + Prettier + Husky |

---

## Migration Strategy

### Phase 1: Infrastructure Setup (Week 1)
**Objectives:**
- Set up new VM (192.168.142.237)
- Install required software stack
- Configure SSH key authentication
- Initialize Git repository
- Set up CI/CD pipeline

**Tasks:**
1. Install Ubuntu 22.04 LTS (if not already)
2. Install Node.js 20 LTS
3. Install MySQL 8.0 / MariaDB 10.11
4. Install Nginx
5. Install PM2 for process management
6. Configure firewall (UFW)
7. Set up SSH key pair
8. Clone GitHub repository (multpanelreact)
9. Set up environment variables structure

**Deliverables:**
- Fully configured development/staging server
- Automated deployment scripts
- Environment setup documentation

### Phase 2: Backend Foundation (Week 2-3)
**Objectives:**
- Create TypeScript backend structure
- Implement core authentication
- Set up database migrations
- Create API documentation

**Tasks:**
1. Initialize Node.js + TypeScript project
2. Set up Express server with TypeScript
3. Configure database connection (TypeORM or Prisma)
4. Port database schema to TypeScript models
5. Implement JWT authentication system
6. Create middleware (auth, error handling, logging)
7. Set up Swagger/OpenAPI documentation
8. Implement rate limiting
9. Create base API endpoints structure
10. Set up environment configuration

**Key Files:**
```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── jwt.ts
│   │   └── environment.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimiter.ts
│   │   └── validation.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Company.ts
│   │   └── [all other models]
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   └── [feature routes]
│   ├── services/
│   │   ├── AuthService.ts
│   │   ├── ProxmoxService.ts
│   │   └── [feature services]
│   ├── utils/
│   │   ├── encryption.ts
│   │   ├── logger.ts
│   │   └── validators.ts
│   └── index.ts
├── migrations/
├── tests/
└── package.json
```

**Deliverables:**
- Functional TypeScript backend
- Complete API documentation
- Authentication system working
- Database migrations ready

### Phase 3: Frontend Foundation (Week 4-5)
**Objectives:**
- Create React + TypeScript project
- Implement design system
- Build core layouts and navigation
- Set up routing and state management

**Tasks:**
1. Initialize Vite + React + TypeScript
2. Choose and configure UI library (MUI or Ant Design)
3. Set up routing (React Router v6)
4. Configure state management (Zustand)
5. Create authentication context
6. Build main layout components
7. Implement navigation system
8. Create form utilities
9. Set up API client with interceptors
10. Build reusable components library

**Key Files:**
```
frontend/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   └── Form/
│   │   ├── layout/
│   │   │   ├── MainLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   └── [feature components]
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   └── [feature pages]
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── [feature services]
│   ├── store/
│   │   ├── authStore.ts
│   │   └── [feature stores]
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── [custom hooks]
│   ├── types/
│   │   └── [TypeScript interfaces]
│   ├── utils/
│   │   ├── validators.ts
│   │   └── formatters.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
└── package.json
```

**Deliverables:**
- Responsive React application
- Design system implemented
- Authentication flow working
- Main navigation structure

### Phase 4: Core Feature Migration (Week 6-10)
**Priority Order:**

#### Sprint 1: Authentication & User Management (Week 6)
- Login/logout
- JWT token refresh
- Session management
- User CRUD
- Role management
- Permission profiles

#### Sprint 2: Company & Cluster Management (Week 7)
- Company CRUD
- Cluster CRUD
- Company-cluster assignments
- Quotas management
- Cluster health monitoring

#### Sprint 3: VM Management (Week 8-9)
- VM list with filters
- VM creation wizard
- VM operations (start/stop/restart)
- VM deletion workflow
- Project management
- Template management

#### Sprint 4: Network Management (Week 10)
- IP range management
- VM IP assignments
- VLAN configuration
- NAT rules

### Phase 5: Advanced Features (Week 11-14)

#### Sprint 5: OPNsense & Firewall (Week 11)
- OPNsense template management
- Firewall deployment
- Configuration generation
- Status monitoring

#### Sprint 6: Disaster Recovery (Week 12)
- DR cluster pairing
- Replication policies
- Sync status monitoring
- Failover management

#### Sprint 7: Additional Features (Week 13-14)
- Billing & usage tracking
- Activity logs
- Articles management
- Feedback system
- SSL certificate management
- URL mapping & branding

### Phase 6: Testing & Optimization (Week 15-16)
**Objectives:**
- Comprehensive testing
- Performance optimization
- Security audit
- Documentation completion

**Tasks:**
1. Write unit tests (Jest)
2. Write integration tests
3. Write E2E tests (Playwright)
4. Performance profiling
5. Security penetration testing
6. Load testing
7. Code review and refactoring
8. API documentation completion
9. User documentation
10. Deployment guide

### Phase 7: Production Deployment (Week 17)
**Objectives:**
- Production deployment
- Data migration from old system
- Monitoring setup
- Backup strategy

**Tasks:**
1. Set up production environment
2. Configure Nginx reverse proxy
3. Set up PM2 with cluster mode
4. Configure SSL certificates
5. Set up database replication
6. Implement backup automation
7. Configure monitoring (PM2 + custom)
8. Data migration script
9. Smoke testing in production
10. Go-live!

---

## Key Improvements in New System

### 1. **Type Safety**
- End-to-end TypeScript for compile-time error catching
- Reduced runtime errors
- Better IDE support and auto-completion

### 2. **Developer Experience**
- Hot Module Replacement (HMR) with Vite
- Fast rebuild times
- Modern tooling (ESLint, Prettier)
- Git hooks with Husky

### 3. **UI/UX Enhancements**
- Modern, responsive design
- Component reusability
- Consistent design language
- Better accessibility (WCAG 2.1 AA)

### 4. **Performance**
- Code splitting and lazy loading
- Optimized bundle sizes
- Server-side rendering ready (if needed)
- Better caching strategies

### 5. **Testing**
- Automated unit tests
- Integration testing
- E2E testing
- CI/CD pipeline integration

### 6. **API Documentation**
- Interactive Swagger UI
- Auto-generated from code
- Type-safe API contracts
- Example requests/responses

### 7. **Security Enhancements**
- TypeScript type safety prevents common bugs
- Better input validation with Zod
- Automated security scanning
- Dependency vulnerability checking

### 8. **Maintainability**
- Clear folder structure
- Separation of concerns
- Reusable components
- Comprehensive documentation

### 9. **Customization**
- Theme system
- White-label ready
- Plugin architecture (future)
- Multi-language support (i18n ready)

### 10. **Monitoring & Debugging**
- Better error tracking
- Performance monitoring
- Request logging
- User activity tracking

---

## Technology Decisions

### Frontend Framework: React + TypeScript
**Why React?**
- Most popular framework with largest ecosystem
- Excellent TypeScript support
- Component reusability
- Virtual DOM for performance
- Strong community and resources

**Alternatives Considered:**
- Vue.js: Good, but smaller ecosystem
- Angular: Too heavy for this use case
- Svelte: Great performance, but smaller ecosystem

### UI Component Library: Material-UI (MUI)
**Why MUI?**
- Comprehensive component library
- Excellent TypeScript support
- Customizable theming
- Accessibility built-in
- Regular updates and maintenance

**Alternatives Considered:**
- Ant Design: Good for admin panels, but MUI is more modern
- Chakra UI: Nice, but smaller ecosystem
- Tailwind CSS + Headless UI: More flexibility, but more work

### State Management: Zustand
**Why Zustand?**
- Simple and lightweight
- TypeScript first
- No boilerplate
- Good performance
- Easy to learn

**Alternatives Considered:**
- Redux Toolkit: More complex, but powerful
- Recoil: Good, but smaller community
- Context API: Built-in, but can be verbose

### Backend: Node.js + Express + TypeScript
**Why Node.js?**
- JavaScript/TypeScript across stack
- Large ecosystem (npm)
- Excellent async I/O for API server
- Easy to scale

**Why Express?**
- Battle-tested
- Minimal overhead
- Large middleware ecosystem
- Easy to understand

**Alternatives Considered:**
- NestJS: Too heavy for this project
- Fastify: Faster, but Express is more familiar
- Koa: Good, but smaller ecosystem

### ORM: Prisma
**Why Prisma?**
- Excellent TypeScript support
- Type-safe database queries
- Auto-generated types
- Migrations system
- Good documentation

**Alternatives Considered:**
- TypeORM: More feature-rich, but more complex
- Sequelize: Older, less TypeScript support
- Knex.js: Lower-level, more work

### Build Tool: Vite
**Why Vite?**
- Lightning-fast HMR
- Native ESM support
- Optimized production builds
- Great DX

**Alternatives Considered:**
- Webpack: Powerful but slower
- Rollup: Good, but Vite is built on it
- Parcel: Simple, but less configurable

---

## Estimated Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 1 | 1 week | Infrastructure Setup |
| Phase 2 | 2 weeks | Backend Foundation |
| Phase 3 | 2 weeks | Frontend Foundation |
| Phase 4 | 5 weeks | Core Feature Migration |
| Phase 5 | 4 weeks | Advanced Features |
| Phase 6 | 2 weeks | Testing & Optimization |
| Phase 7 | 1 week | Production Deployment |
| **Total** | **17 weeks** | **~4 months** |

---

## Resource Requirements

### Development Team (Ideal)
- 1 Full-stack Developer (Lead)
- 1 Frontend Developer
- 1 Backend Developer
- 1 QA Engineer
- 1 DevOps Engineer (part-time)

### Infrastructure
- Development VM: 192.168.142.237
- Staging environment (can use same VM)
- Production environment (separate later)
- GitHub repository
- CI/CD pipeline (GitHub Actions)

### Tools & Services
- GitHub account (free tier OK for now)
- Domain name for production
- SSL certificates (Let's Encrypt)
- Monitoring service (optional)
- Error tracking (Sentry - free tier)

---

## Risk Mitigation

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Proxmox API compatibility | High | Thorough testing, API wrapper |
| Data migration issues | High | Comprehensive testing, rollback plan |
| Performance degradation | Medium | Load testing, optimization |
| Security vulnerabilities | High | Security audit, penetration testing |
| TypeScript learning curve | Low | Training, pair programming |

### Project Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Timeline overrun | Medium | Buffer time, regular progress reviews |
| Scope creep | Medium | Clear requirements, change control |
| Key person departure | High | Documentation, knowledge sharing |
| Budget overrun | Low | Regular cost tracking |

---

## Success Metrics

### Technical Metrics
- **Page Load Time**: < 2 seconds
- **API Response Time**: < 500ms (95th percentile)
- **Test Coverage**: > 80%
- **TypeScript Strict Mode**: 100% compliance
- **Accessibility Score**: > 90 (Lighthouse)
- **Security Score**: A+ (Mozilla Observatory)

### Business Metrics
- **User Satisfaction**: > 4.5/5
- **Bug Reports**: < 10 per month (after stabilization)
- **Downtime**: < 0.1% (99.9% uptime)
- **Feature Completion**: 100% of current features

---

## Post-Migration Plan

### Immediate (Month 1)
- Monitor system stability
- Fix critical bugs
- User training
- Documentation updates

### Short-term (Months 2-3)
- Gather user feedback
- Implement minor enhancements
- Performance tuning
- Security hardening

### Long-term (Months 4-6)
- New feature development
- Mobile app consideration
- Multi-language support
- Advanced analytics
- API marketplace

---

## Conclusion

This migration represents a significant investment in the platform's future. The move to React + TypeScript will provide:

✅ Better developer experience
✅ Improved maintainability
✅ Enhanced type safety
✅ Modern UI/UX
✅ Better testing capabilities
✅ Scalability for future growth
✅ Product-ready architecture

The 17-week timeline is aggressive but achievable with dedicated resources. The phased approach allows for iterative development and early testing.

---

## Next Steps

1. **Review and approve this migration plan**
2. **Set up new VM (192.168.142.237)**
3. **Initialize GitHub repository (multpanelreact)**
4. **Begin Phase 1: Infrastructure Setup**
5. **Weekly progress meetings to track milestones**

---

**Document Version**: 1.0
**Last Updated**: December 4, 2025
**Status**: Draft - Awaiting Approval
