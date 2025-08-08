# GitHub Workflow Documentation

This document describes the comprehensive GitHub workflow system implemented for the TCG Price Tracker project.

## Overview

The workflow system replaces the basic "merge to main" approach with a robust, production-ready CI/CD pipeline that includes:

- ✅ Automated testing and quality checks
- ✅ Security scanning and vulnerability management
- ✅ Automated deployments with rollback capabilities
- ✅ Emergency hotfix procedures
- ✅ Dependency management and updates

## Branch Strategy

### Branch Structure
```
main (production)
├── develop (integration)
├── feature/feature-name
├── bugfix/bug-description
├── hotfix/emergency-fix
└── release/version-number
```

### Branch Rules

#### Main Branch
- **Protection**: Maximum protection enabled
- **Merges**: Only via approved pull requests
- **Requirements**: 2+ approvals, all CI checks must pass
- **Direct Pushes**: Forbidden
- **Force Pushes**: Forbidden
- **Deletions**: Forbidden

#### Develop Branch  
- **Protection**: Standard protection
- **Merges**: Via approved pull requests
- **Requirements**: 1+ approval, all CI checks must pass
- **Direct Pushes**: Forbidden (maintainers can push with caution)

#### Feature Branches
- **Naming**: `feature/description` or `feature/issue-number`
- **Source**: Created from `develop`
- **Target**: Merge back to `develop`
- **Lifetime**: Delete after successful merge

#### Hotfix Branches
- **Naming**: `hotfix/critical-issue`  
- **Source**: Created from `main`
- **Target**: Merge to both `main` and `develop`
- **Process**: Emergency workflow with fast-track approval

## Workflows

### 1. Continuous Integration (`ci.yml`)

**Triggers**: Push to any branch, Pull Request creation/update

**Jobs**:
- **Code Quality**: Linting, formatting, type checking
- **Security Scan**: Bandit, Safety, secret detection
- **Testing**: Unit tests, integration tests, coverage
- **Build**: Docker image build and security scan
- **Integration Test**: Full application testing

**Quality Gates**:
- Code coverage > 80%
- No security vulnerabilities
- All tests pass
- Docker image security scan passes

### 2. Staging Deployment (`cd-staging.yml`)

**Triggers**: Push to `develop` branch

**Process**:
1. Build and push container image
2. Deploy to staging environment
3. Run smoke tests
4. Performance regression tests
5. Notify deployment status

**Environment**: `staging`
- URL: https://staging-tcg.yourdomain.com
- Database: Staging PostgreSQL
- Redis: Staging instance
- API Keys: Test/staging credentials

### 3. Production Deployment (`cd-production.yml`)

**Triggers**: Push to `main` branch, Manual dispatch

**Process**:
1. Pre-deployment validation
2. Build production image with signing
3. Database migrations (with approval)
4. Blue-green deployment
5. Health checks and smoke tests
6. Performance monitoring
7. Automatic rollback on failure

**Environment**: `production`
- URL: https://tcg.yourdomain.com  
- Database: Production PostgreSQL with replicas
- Redis: Production cluster
- API Keys: Live credentials

### 4. Emergency Hotfix (`hotfix.yml`)

**Triggers**: Manual dispatch only

**Process**:
1. Validate hotfix request
2. Emergency quality checks
3. Fast-track testing (minimal or standard)
4. Emergency deployment
5. Enhanced monitoring
6. Automatic rollback on failure

**Approval**: Requires severity level and rollback plan

### 5. Dependency Updates (`dependency-update.yml`)

**Triggers**: Weekly schedule (Mondays 2 AM UTC), Manual dispatch

**Process**:
1. Scan for security vulnerabilities
2. Check for outdated packages
3. Apply security updates immediately
4. Apply minor updates (if requested)
5. Create pull request with changes
6. Monitor for critical vulnerabilities

**Types**:
- **Security Only**: Critical security patches
- **Minor Updates**: Compatible minor version updates  
- **All Updates**: Including major version updates (manual only)

## Security Features

### Automated Security Scanning
- **SAST**: Static Application Security Testing (Bandit)
- **Dependency Scanning**: Vulnerability detection (Safety)
- **Container Scanning**: Image security analysis (Trivy)
- **Secret Detection**: Prevent credential leaks (TruffleHog)
- **License Compliance**: Open source license verification

### Security Gates
- No high/critical vulnerabilities allowed
- All secrets stored in GitHub Secrets
- Container images signed with Cosign
- SBOM (Software Bill of Materials) generation
- Security-focused code reviews required

### Compliance
- All changes tracked through pull requests
- Immutable audit trail
- Signed commits (optional but recommended)
- Deployment approvals for production
- Security incident response procedures

## Monitoring & Alerting

### Deployment Monitoring
- Real-time status in Slack/Discord
- Performance metrics comparison
- Error rate monitoring
- Health check validation

### Application Monitoring
- API endpoint health checks (30s intervals)
- Database connectivity monitoring
- External API dependency tracking
- Memory and CPU usage alerts

### Failure Response
- **Level 1**: Team notifications (Slack/Discord)
- **Level 2**: Email alerts (persistent issues)
- **Level 3**: PagerDuty/oncall (production outages)
- **Level 4**: Management escalation (business impact)

## Pull Request Process

### PR Template Checklist
- [ ] Type of change identified
- [ ] Testing performed and documented
- [ ] Database changes reviewed
- [ ] Security considerations addressed
- [ ] Performance impact assessed
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Deployment notes provided
- [ ] Rollback plan prepared

### Review Requirements
- **Main Branch**: 2+ approvals required
- **Develop Branch**: 1+ approval required
- **CODEOWNERS**: Expertise-based reviews
- **Security Changes**: Additional security review
- **Database Changes**: DBA approval
- **Breaking Changes**: Architecture review

### Quality Gates
- All CI checks must pass
- No unresolved conversations
- Branch up-to-date with target
- Code coverage maintained
- Security scan passes

## Environment Management

### Environment Hierarchy
```
Development (Local) → Staging → Production
                 ↘ Feature Environments (optional)
```

### Configuration Management
- Environment-specific secrets in GitHub Secrets
- Infrastructure as Code (IaC) templates
- Consistent environment configuration
- Blue-green deployment support

### Database Management
- Automated migration testing
- Rollback capability for all migrations  
- Staging database mirrors production
- Backup before production migrations
- Data integrity validation

## Emergency Procedures

### Hotfix Deployment
1. **Assessment**: Determine severity level
2. **Branch Creation**: Create hotfix branch from main
3. **Fast-track Review**: Emergency approval process
4. **Deployment**: Use emergency workflow
5. **Monitoring**: Enhanced monitoring activated
6. **Follow-up**: Regular fix via normal process

### Rollback Procedures
1. **Automatic**: Triggered by health check failures
2. **Manual**: Via GitHub Actions dispatch
3. **Database**: Restoration from backup if needed
4. **Verification**: Health checks and smoke tests
5. **Communication**: Team and stakeholder notification

### Incident Response
1. **Detection**: Automated monitoring alerts
2. **Assessment**: Impact and severity analysis
3. **Response**: Execute appropriate procedure
4. **Communication**: Status updates to stakeholders
5. **Resolution**: Fix implementation and verification
6. **Post-mortem**: Review and improvement planning

## Best Practices

### Development Workflow
1. Create feature branch from develop
2. Make changes with comprehensive tests
3. Submit pull request with detailed description
4. Address review feedback
5. Merge after all approvals and checks
6. Delete feature branch after merge

### Code Quality Standards
- **Test Coverage**: Minimum 80% code coverage
- **Code Style**: Black formatting, isort imports
- **Type Hints**: MyPy type checking enforced
- **Documentation**: Code comments and docstrings
- **Security**: No hardcoded secrets or credentials

### Deployment Best Practices
- **Gradual Rollout**: Feature flags for large changes
- **Monitoring**: Watch key metrics during deployment
- **Rollback Ready**: Always have rollback plan
- **Communication**: Keep team informed of deployments
- **Documentation**: Update runbooks and procedures

## Troubleshooting

### Common Issues

#### CI Pipeline Failures
- **Tests Failing**: Check test environment setup
- **Security Scan**: Review and fix vulnerability
- **Build Issues**: Verify Docker configuration
- **Coverage Drop**: Add tests for new code

#### Deployment Failures
- **Health Checks**: Verify application startup
- **Database**: Check migration status
- **Configuration**: Validate environment variables
- **Dependencies**: Ensure all services running

#### Performance Issues
- **Response Time**: Check database queries
- **Memory Usage**: Review application metrics
- **Error Rates**: Analyze application logs
- **External APIs**: Verify third-party services

### Getting Help

#### Documentation
- API Documentation: `/docs` endpoint
- Database Schema: `migrations/` directory
- Configuration: `config.py` and environment files
- Monitoring: Grafana dashboards (if configured)

#### Team Communication
- **Slack/Discord**: Real-time team communication
- **GitHub Issues**: Bug reports and feature requests
- **Pull Requests**: Code review and discussion
- **Wiki**: Additional documentation and guides

#### Emergency Contacts
- **On-call Engineer**: (Configure PagerDuty/oncall)
- **DevOps Team**: (Configure team notifications)
- **Security Team**: (Configure security alerts)
- **Management**: (Configure escalation procedures)

## Future Enhancements

### Planned Improvements
- [ ] Advanced deployment strategies (canary, rolling)
- [ ] Comprehensive performance testing
- [ ] Enhanced security scanning (DAST)
- [ ] Multi-region deployment support
- [ ] Advanced monitoring and alerting

### Metrics and KPIs
- Deployment frequency and success rate
- Mean time to recovery (MTTR)
- Lead time for changes
- Security vulnerability resolution time
- Test coverage and quality metrics

---

## Quick Reference

### Useful Commands
```bash
# Create feature branch
git checkout develop
git checkout -b feature/my-new-feature

# Run tests locally
cd tcgtracker
poetry run pytest tests/

# Security scan
poetry run bandit -r src/
poetry run safety check

# Database migration
poetry run tcg-cli db upgrade
```

### GitHub Actions Dispatch
```bash
# Manual deployment
gh workflow run cd-production.yml

# Emergency hotfix
gh workflow run hotfix.yml \
  -f hotfix_branch=hotfix/critical-bug \
  -f severity=critical \
  -f description="Fix authentication bypass"

# Dependency updates
gh workflow run dependency-update.yml \
  -f update_type=security_only
```

### Environment URLs
- **Production**: https://tcg.yourdomain.com
- **Staging**: https://staging-tcg.yourdomain.com
- **API Docs**: https://tcg.yourdomain.com/docs
- **Health Check**: https://tcg.yourdomain.com/health

---

**Last Updated**: $(date)  
**Version**: 1.0  
**Maintained by**: TCG Price Tracker Team