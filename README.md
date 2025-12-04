# Proxmox Multi-Tenant Platform - React + TypeScript

Modern rebuild of the Proxmox Multi-Tenant management platform using React, TypeScript, and Node.js.

## Features

- ✅ Multi-tenant management
- ✅ Virtual machine lifecycle management
- ✅ Advanced authentication & security (JWT, 2FA, CSRF)
- ✅ Network management (IP ranges, VLANs, NAT)
- ✅ OPNsense firewall automation
- ✅ Disaster recovery system
- ✅ Cluster management
- ✅ SSO integration (Microsoft Azure AD)
- ✅ Billing & usage tracking
- ✅ Activity logging
- And 25+ more features...

## Technology Stack

### Frontend
- React 18
- TypeScript (strict mode)
- Vite
- Material-UI (MUI)
- Zustand (state management)
- React Hook Form + Zod (forms & validation)
- React Router v6

### Backend
- Node.js 20 LTS
- Express
- TypeScript (strict mode)
- Prisma ORM
- JWT authentication
- Swagger/OpenAPI 3.0

### Infrastructure
- Nginx (reverse proxy)
- MySQL 8
- PM2 (process manager)
- Ubuntu 24.04 LTS

## Quick Start

See [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for detailed setup instructions.

## Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Migration from PHP Version

This is a complete rewrite of the PHP/Vanilla JS version. See [MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md) for the migration strategy.

## Documentation

- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Migration Plan](docs/MIGRATION_PLAN.md)
- [Session Summary](docs/SESSION_SUMMARY.md)
- [API Documentation](http://192.168.142.237/api/docs) (Swagger UI)

## Servers

- **Old System (PHP)**: 192.168.142.236
- **New System (React)**: 192.168.142.237

## License

Private project - All rights reserved

---

**Version**: 2.0.0  
**Last Updated**: December 4, 2025  
**Status**: Under Development
