# Operations & Monitoring Guide

This document provides comprehensive guidance for operating, monitoring, and maintaining the AI Document Chat application in production.

## Table of Contents

- [Monitoring Overview](#monitoring-overview)
- [Alerting Configuration](#alerting-configuration)
- [Incident Response Procedures](#incident-response-procedures)
- [Performance Troubleshooting](#performance-troubleshooting)
- [Capacity Planning](#capacity-planning)
- [Security Incident Procedures](#security-incident-procedures)
- [Maintenance Schedule](#maintenance-schedule)

---

## Monitoring Overview

### Monitoring Stack

The application uses multiple monitoring tools:

| Tool | Purpose | Access |
|------|---------|--------|
| **Sentry** | Error tracking and performance | https://sentry.io |
| **Vercel Analytics** | Performance and traffic | Vercel Dashboard |
| **Supabase Dashboard** | Database metrics | supabase.com |
| **Custom Uptime Monitor** | System health | Local/Docker |
| **Uptime Robot** | External monitoring | uptimerobot.com |

### Key Metrics

#### Application Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Response Time (p95) | < 2s | > 3s | > 5s |
| Error Rate | < 1% | > 2% | > 5% |
| Uptime | 99.9% | < 99.5% | < 99% |

#### Business Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Document Processing | 95% < 30s | Upload to searchable |
| Chat Latency | < 3s | First response token |
| Citation Accuracy | > 90% | Correct source references |

### Health Check Endpoint

Monitor the health endpoint at `/api/health`:

```bash
curl https://your-domain.com/api/health
```

Response includes:
- Overall system status
- Individual service health
- Response times
- Resource utilization

---

## Alerting Configuration

### Sentry Alerts

#### Error Alerts

**Critical Errors** (Immediate notification):
- Application crashes
- Database connection failures
- Authentication bypass attempts

**Warning Errors** (Daily digest):
- Validation failures
- Rate limit hits
- Performance degradation

#### Performance Alerts

**Transaction Slowdowns**:
- API response > 5s
- Database queries > 1s
- External API calls > 10s

### Setting Up Alerts

1. Navigate to Sentry Dashboard → Alerts
2. Create New Alert
3. Select conditions:
   - Error count > threshold
   - Performance degradation
   - User impact percentage

### Alert Channels

#### Slack Integration

```yaml
# Alert configuration
channels:
  - name: alerts
    type: slack
    webhook_url: https://hooks.slack.com/services/...
    channel: '#alerts'
    severity_levels:
      critical: '🚨'
      warning: '⚠️'
      info: 'ℹ️'
```

#### Email Alerts

Configure email for critical alerts:

```yaml
email:
  recipients:
    - ops-team@company.com
    - oncall@company.com
  severity_levels:
    critical: enabled
    warning: daily digest
```

---

## Incident Response Procedures

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1 - Critical** | Service down, data loss | 15 min | Site unavailable, DB corruption |
| **P2 - High** | Major feature broken | 1 hour | Chat not working, uploads failing |
| **P3 - Medium** | Minor feature issue | 4 hours | Slow responses, some errors |
| **P4 - Low** | Non-critical issue | 24 hours | UI glitches, warnings |

### Incident Response Playbook

#### P1: Service Down

**Step 1: Acknowledge (0-15 min)**
- Check status dashboards
- Confirm incident severity
- Notify on-call engineer
- Start incident channel in Slack

**Step 2: Diagnose (15-30 min)**
- Check application logs (Vercel/Sentry)
- Check database status (Supabase)
- Check external services (OpenAI status)
- Identify root cause

**Step 3: Mitigate (30-60 min)**
- Apply fix or rollback
- Verify service recovery
- Monitor for stability
- Update stakeholders

**Step 4: Resolve (1-4 hours)**
- Document root cause
- Create post-mortem
- Implement prevention
- Close incident

#### P2: Major Feature Down

**Step 1: Acknowledge (0-1 hour)**
- Triage incident
- Notify team
- Assess impact

**Step 2: Investigate (1-2 hours)**
- Review logs and metrics
- Identify affected components
- Determine fix approach

**Step 3: Fix (2-4 hours)**
- Implement solution
- Deploy fix
- Verify recovery

**Step 4: Document (4-8 hours)**
- Create ticket for improvements
- Update runbook if needed

### Post-Incident Review

For all P1 and P2 incidents, complete:

```markdown
## Incident Report

**Incident ID**: INC-YYYY-MM-###
**Date**: YYYY-MM-DD
**Duration**: HH:MM
**Severity**: P1/P2

### Summary
Brief description of the incident.

### Impact
- Users affected: XXX
- Business impact: Description
- Data impact: None/Lost/Compromised

### Root Cause
Technical explanation of what went wrong.

### Timeline
- HH:MM - Event 1
- HH:MM - Event 2
- HH:MM - Resolution

### Resolution
What was done to fix the issue.

### Lessons Learned
- What went well
- What went poorly
- Action items:
  - [ ] Immediate fix
  - [ ] Medium-term improvement
  - [ ] Long-term prevention
```

---

## Performance Troubleshooting

### Slow Response Times

#### Diagnosis Steps

1. **Check database performance**:
   ```sql
   -- Slow queries
   SELECT query, calls, mean_time, rows 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

2. **Check cache hit rate**:
   - Monitor Redis cache hit ratio
   - Check for cache misses
   - Verify cache size limits

3. **Check external API latency**:
   - OpenAI response times
   - Supabase query times

#### Common Issues and Fixes

**Slow Database Queries**:
- Add missing indexes
- Optimize query patterns
- Increase connection pool size

**High Memory Usage**:
- Check for memory leaks
- Increase server size
- Implement pagination

**Network Bottlenecks**:
- Use CDN for static assets
- Enable compression
- Optimize payload sizes

### High Error Rates

#### Diagnosis Steps

1. **Check Sentry for error patterns**
2. **Identify error types**
3. **Review recent deployments**
4. **Check external service status**

#### Common Error Patterns

**Authentication Errors**:
- Check JWT token expiration
- Verify Supabase Auth status
- Review RLS policies

**Rate Limiting**:
- Monitor rate limit headers
- Check for abuse
- Implement request queuing

**Timeout Errors**:
- Increase timeout thresholds
- Optimize slow operations
- Implement async processing

---

## Capacity Planning

### Current Capacity

| Resource | Current Usage | Limit | Headroom |
|----------|--------------|-------|----------|
| Database Connections | 50 | 500 | 450 |
| Storage | 10GB | 100GB | 90GB |
| API Requests/day | 10,000 | 100,000 | 90,000 |
| Embeddings/month | 1M tokens | 10M tokens | 9M tokens |

### Scaling Triggers

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| Database Connections | > 250 | > 400 |
| Storage | > 50GB | > 80GB |
| API Requests | > 50,000/day | > 80,000/day |
| Token Usage | > 5M/month | > 8M/month |

### Scaling Actions

**Database Scaling**:
- Vertical: Increase Supabase plan
- Horizontal: Read replicas (Enterprise)

**API Scaling**:
- Vercel scales automatically
- Rate limit increase via Supabase

**Storage Scaling**:
- Upgrade Supabase storage
- Implement data archival

---

## Security Incident Procedures

### Suspicious Activity

**Indicators**:
- Unusual login locations
- Failed authentication spikes
- Unexpected API call patterns
- Data access anomalies

### Response Steps

1. **Detect** - Review alerts and logs
2. **Assess** - Determine severity and scope
3. **Contain** - Block suspicious activity
4. **Investigate** - Gather evidence
5. **Remediate** - Fix vulnerability
6. **Notify** - Stakeholders and users

### Security Contacts

| Contact | Purpose |
|---------|---------|
| Security Team | security@company.com |
| On-Call Engineer | Via PagerDuty |
| Legal | legal@company.com |
| Public Relations | pr@company.com |

### Data Breach Response

If user data is compromised:

1. **Immediate (0-1 hour)**:
   - Contain breach
   - Preserve evidence
   - Notify security team

2. **Assessment (1-4 hours)**:
   - Determine scope
   - Identify affected users
   - Assess regulatory requirements

3. **Notification (24-72 hours)**:
   - Notify affected users
   - Report to authorities (if required)
   - Issue public statement

4. **Remediation**:
   - Fix vulnerability
   - Reset compromised credentials
   - Enhance security controls

---

## Maintenance Schedule

### Daily Tasks

- [ ] Review Sentry error dashboard
- [ ] Check uptime monitor status
- [ ] Review rate limit warnings
- [ ] Monitor storage usage

### Weekly Tasks

- [ ] Review performance metrics
- [ ] Check security scan results
- [ ] Review access logs
- [ ] Validate backup completion
- [ ] Check dependency updates

### Monthly Tasks

- [ ] Security audit review
- [ ] Performance trend analysis
- [ ] Capacity planning review
- [ ] Cost analysis
- [ ] Penetration testing (quarterly)

### Quarterly Tasks

- [ ] Full security assessment
- [ ] Disaster recovery test
- [ ] Performance benchmark
- [ ] Vendor review
- [ ] Architecture review

### Maintenance Windows

**Scheduled Maintenance**:
- Every 2nd Sunday, 2:00 AM - 4:00 AM UTC
- Notify users 72 hours in advance

**Emergency Maintenance**:
- As needed with minimal notice
- Used for critical security patches

---

## Runbook: Common Issues

### Issue: Database Connection Errors

**Symptoms**:
- "connection refused" errors
- Slow response times
- Timeouts on API calls

**Diagnosis**:
```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check for idle connections
SELECT count(*) FROM pg_stat_activity 
WHERE state = 'idle';
```

**Resolution**:
1. Check connection pool settings
2. Restart connection pool
3. Scale database if needed

**Prevention**:
- Implement connection pooling
- Use keep-alive connections
- Monitor connection usage

### Issue: High API Latency

**Symptoms**:
- Slow page loads
- Timeout errors
- User complaints

**Diagnosis**:
```bash
# Check response times
curl -w "\nTime: %{time_total}s\n" https://api.example.com/health
```

**Resolution**:
1. Identify slow endpoints
2. Check database queries
3. Review external API calls
4. Optimize or cache slow operations

**Prevention**:
- Implement caching
- Use CDN
- Monitor performance trends

### Issue: Document Processing Failures

**Symptoms**:
- Documents stuck in "processing" status
- Upload failures
- Missing chunks

**Diagnosis**:
```bash
# Check processing queue
SELECT status, COUNT(*) 
FROM documents 
GROUP BY status;
```

**Resolution**:
1. Check OpenAI API status
2. Verify embedding generation
3. Reprocess failed documents

**Prevention**:
- Implement retry logic
- Add dead letter queue
- Monitor processing time

---

## Contact Information

### Internal Contacts

| Role | Contact | Responsibility |
|------|---------|----------------|
| On-Call Engineer | PagerDuty | Immediate response |
| DevOps Lead | Via Slack | Infrastructure |
| Engineering Manager | Via Slack | Technical decisions |
| Security Team | security@company.com | Security incidents |

### External Contacts

| Service | Contact | Purpose |
|---------|---------|---------|
| Vercel Support | vercel.com/support | Platform issues |
| Supabase Support | supabase.com/support | Database issues |
| OpenAI Support | platform.openai.com/help | API issues |
| Sentry Support | sentry.io/support | Monitoring issues |

---

**Document Owner**: DevOps Team  
**Last Review**: 2026-02-07  
**Next Review**: 2026-05-07  
**Version**: 1.0.0
