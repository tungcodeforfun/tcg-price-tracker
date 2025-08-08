# Pull Request

## Description
<!-- Provide a brief description of the changes in this PR -->

## Type of Change
<!-- Mark the appropriate option with an "x" -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Performance improvement
- [ ] Code refactoring
- [ ] Documentation update
- [ ] Database migration
- [ ] Security fix
- [ ] Infrastructure/DevOps change

## Changes Made
<!-- List the specific changes made in this PR -->
- 
- 
- 

## Testing Performed
<!-- Describe the tests you ran and how to reproduce them -->
- [ ] Unit tests pass locally
- [ ] Integration tests pass locally
- [ ] API tests pass (if applicable)
- [ ] Database migration tested (if applicable)
- [ ] Manual testing performed

### Test Coverage
- [ ] Added tests for new functionality
- [ ] Updated existing tests for modified functionality
- [ ] Code coverage maintained or improved

## Database Changes
<!-- If this PR includes database changes -->
- [ ] Migration script created
- [ ] Migration tested locally (up and down)
- [ ] Migration tested on staging environment
- [ ] Data migration includes rollback strategy
- [ ] Database changes are backward compatible

## Security Considerations
<!-- Security review checklist -->
- [ ] No hardcoded secrets or API keys
- [ ] Input validation implemented for new endpoints
- [ ] Authentication/authorization checked
- [ ] SQL injection prevention verified
- [ ] XSS prevention implemented (if applicable)
- [ ] Security dependencies updated
- [ ] No sensitive data logged

## Performance Impact
<!-- Performance considerations -->
- [ ] No performance regression identified
- [ ] Database queries optimized
- [ ] API response times acceptable
- [ ] Memory usage acceptable
- [ ] Caching implemented where appropriate

## Breaking Changes
<!-- List any breaking changes and migration guide -->
- [ ] No breaking changes
- [ ] Breaking changes documented below

**Breaking Changes Details:**
<!-- If there are breaking changes, describe them and provide migration guide -->

## Documentation
<!-- Documentation updates -->
- [ ] Code comments added/updated
- [ ] API documentation updated (if applicable)
- [ ] README updated (if applicable)
- [ ] Changelog updated

## Deployment Notes
<!-- Special deployment considerations -->
- [ ] No special deployment steps required
- [ ] Requires environment variable changes
- [ ] Requires manual deployment steps (list below)
- [ ] Requires coordination with other services

**Special Deployment Steps:**
<!-- List any special deployment requirements -->

## Rollback Plan
<!-- How to rollback if issues occur -->
- [ ] Standard rollback (git revert)
- [ ] Database rollback required
- [ ] Manual rollback steps required (list below)

**Manual Rollback Steps:**
<!-- List manual steps if needed -->

## Reviewers
<!-- Tag specific reviewers based on the type of changes -->
- Database changes: @tungcodeforfun
- Security changes: @tungcodeforfun  
- API changes: @tungcodeforfun
- Infrastructure: @tungcodeforfun

## Additional Notes
<!-- Any additional information for reviewers -->

---

**Pre-merge Checklist:**
- [ ] All CI checks passing
- [ ] Required approvals received
- [ ] No unresolved conversations
- [ ] Branch is up-to-date with target branch
- [ ] Security review completed (if required)
- [ ] Performance review completed (if required)