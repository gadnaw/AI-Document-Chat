#!/usr/bin/env node

/**
 * Uptime Monitoring Script
 * 
 * Monitors system health and sends alerts on failures.
 * 
 * Features:
 * - Scheduled health checks every 60 seconds
 * - Multiple endpoint verification
 * - Latency tracking
 * - Alerting on failures (Slack, email)
 * - Uptime metrics calculation
 * - Recovery notifications
 * 
 * Usage:
 *   node scripts/uptime-monitor.js
 *   node scripts/uptime-monitor.js --interval=30
 *   node scripts/uptime-monitor.js --url=https://your-app.com
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Health check interval in seconds
  interval: parseInt(process.env.UPTIME_INTERVAL || '60', 10),
  
  // Target URL to monitor
  url: process.env.UPTIME_TARGET_URL || 'http://localhost:3000',
  
  // Health check endpoint
  healthEndpoint: process.env.UPTIME_HEALTH_ENDPOINT || '/api/health',
  
  // Request timeout in milliseconds
  timeout: parseInt(process.env.UPTIME_TIMEOUT || '10000', 10),
  
  // Alert thresholds
  alertThresholds: {
    consecutiveFailures: parseInt(process.env.UPTIME_ALERT_FAILURES || '3', 10),
    latencyWarning: parseInt(process.env.UPTIME_LATENCY_WARNING || '5000', 10),
    latencyCritical: parseInt(process.env.UPTIME_LATENCY_CRITICAL || '10000', 10),
  },
  
  // Alerting
  alerting: {
    slack: {
      enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL || '#alerts',
    },
    email: {
      enabled: process.env.SMTP_HOST ? true : false,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      alertEmail: process.env.ALERT_EMAIL,
    },
  },
  
  // Logging
  logFile: process.env.UPTIME_LOG_FILE || './logs/uptime.log',
  metricsFile: process.env.UPTIME_METRICS_FILE || './logs/uptime-metrics.json',
};

// State
let state = {
  consecutiveFailures: 0,
  lastSuccess: null as Date | null,
  lastFailure: null as Date | null,
  totalChecks: 0,
  successfulChecks: 0,
  failedChecks: 0,
  latencies: [] as number[],
  startTime: new Date(),
  isHealthy: true,
  alertsSent: [] as Alert[],
};

interface Alert {
  timestamp: Date;
  type: 'failure' | 'recovery' | 'latency_warning' | 'latency_critical';
  message: string;
  details: Record<string, any>;
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
  console.log('🚀 Starting uptime monitor...');
  console.log(`📍 Target: ${CONFIG.url}`);
  console.log(`⏱️  Interval: ${CONFIG.interval}s`);
  console.log(`🚨 Alert after ${CONFIG.alertThresholds.consecutiveFailures} failures`);
  console.log('');

  // Ensure log directory exists
  const logDir = path.dirname(CONFIG.logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Log startup
  logMessage('INFO', 'Uptime monitor started', {
    url: CONFIG.url,
    interval: CONFIG.interval,
  });

  // Run initial check
  await performCheck();

  // Start interval
  setInterval(async () => {
    await performCheck();
  }, CONFIG.interval * 1000);
}

/**
 * Perform a single health check
 */
async function performCheck() {
  const checkStart = Date.now();
  const targetUrl = `${CONFIG.url}${CONFIG.healthEndpoint}`;
  
  console.log(`🔍 Checking ${targetUrl}...`);
  
  try {
    const result = await makeRequest(targetUrl);
    const latency = Date.now() - checkStart;
    
    state.totalChecks++;
    state.successfulChecks++;
    state.lastSuccess = new Date();
    state.consecutiveFailures = 0;
    state.latencies.push(latency);
    
    // Keep only last 100 latencies
    if (state.latencies.length > 100) {
      state.latencies = state.latencies.slice(-100);
    }

    console.log(`✅ Status: ${result.status} | Latency: ${latency}ms`);

    // Check latency thresholds
    if (latency >= CONFIG.alertThresholds.latencyCritical) {
      console.log(`⚠️  CRITICAL: Latency ${latency}ms exceeds ${CONFIG.alertThresholds.latencyCritical}ms`);
      await sendAlert('latency_critical', `Critical latency detected: ${latency}ms`, {
        latency,
        threshold: CONFIG.alertThresholds.latencyCritical,
      });
    } else if (latency >= CONFIG.alertThresholds.latencyWarning) {
      console.log(`⚠️  WARNING: Latency ${latency}ms exceeds ${CONFIG.alertThresholds.latencyWarning}ms`);
      await sendAlert('latency_warning', `High latency detected: ${latency}ms`, {
        latency,
        threshold: CONFIG.alertThresholds.latencyWarning,
      });
    }

    // Check if system was unhealthy and is now recovered
    if (!state.isHealthy) {
      console.log('🎉 System has recovered!');
      await sendAlert('recovery', 'System health check passed', {
        lastFailure: state.lastFailure,
        downtime: state.lastFailure ? Date.now() - state.lastFailure.getTime() : 0,
      });
      state.isHealthy = true;
    }

    // Log success
    logMessage('INFO', 'Health check passed', {
      status: result.status,
      latency,
      url: targetUrl,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    state.totalChecks++;
    state.failedChecks++;
    state.consecutiveFailures++;
    state.lastFailure = new Date();
    state.isHealthy = false;

    console.log(`❌ Failed: ${errorMessage}`);

    // Log failure
    logMessage('ERROR', 'Health check failed', {
      error: errorMessage,
      url: targetUrl,
      consecutiveFailures: state.consecutiveFailures,
    });

    // Check if we should send alert
    if (state.consecutiveFailures >= CONFIG.alertThresholds.consecutiveFailures) {
      console.log(`🚨 ALERT: ${state.consecutiveFailures} consecutive failures detected`);
      await sendAlert('failure', `System health check failed: ${errorMessage}`, {
        consecutiveFailures: state.consecutiveFailures,
        lastSuccess: state.lastSuccess,
        error: errorMessage,
      });
    }
  }

  // Save metrics
  saveMetrics();
}

/**
 * Make HTTP/HTTPS request
 */
async function makeRequest(urlString: string): Promise<{ status: number; data?: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      timeout: CONFIG.timeout,
      headers: {
        'User-Agent': 'UptimeMonitor/1.0',
        'Accept': 'application/json',
      },
    };

    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
            resolve({
              status: res.statusCode,
              data: data ? JSON.parse(data) : undefined,
            });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Send alert via configured channels
 */
async function sendAlert(type: Alert['type'], message: string, details: Record<string, any>) {
  const alert: Alert = {
    timestamp: new Date(),
    type,
    message,
    details,
  };

  state.alertsSent.push(alert);

  // Keep only last 100 alerts
  if (state.alertsSent.length > 100) {
    state.alertsSent = state.alertsSent.slice(-100);
  }

  // Log alert
  logMessage('WARN', `Alert: ${message}`, { type, details });

  // Send to Slack
  if (CONFIG.alerting.slack.enabled) {
    await sendSlackAlert(type, message, details);
  }

  // Send email
  if (CONFIG.alerting.email.enabled) {
    await sendEmailAlert(type, message, details);
  }
}

/**
 * Send Slack alert
 */
async function sendSlackAlert(type: Alert['type'], message: string, details: Record<string, any>) {
  if (!CONFIG.alerting.slack.webhookUrl) return;

  const color = type === 'failure' ? '#FF0000' : 
                type === 'recovery' ? '#00FF00' : 
                type === 'latency_critical' ? '#FF6600' : '#FFFF00';

  const emoji = type === 'failure' ? '🚨' : 
                type === 'recovery' ? '✅' : 
                type === 'latency_critical' ? '🔴' : '⚠️';

  const payload = {
    channel: CONFIG.alerting.slack.channel,
    attachments: [
      {
        color,
        title: `${emoji} ${type.toUpperCase().replace('_', ' ')} Alert`,
        text: message,
        fields: Object.entries(details).map(([key, value]) => ({
          title: key,
          value: typeof value === 'object' ? `\`${JSON.stringify(value)}\`` : String(value),
          short: true,
        })),
        footer: 'Uptime Monitor',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    const response = await fetch(CONFIG.alerting.slack.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`⚠️  Failed to send Slack alert: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`⚠️  Slack alert failed: ${error}`);
  }
}

/**
 * Send email alert
 */
async function sendEmailAlert(type: Alert['type'], message: string, details: Record<string, any>) {
  if (!CONFIG.alerting.email.enabled || !CONFIG.alerting.email.smtpHost) {
    console.log(`📧 Email alerting not configured (set SMTP_HOST to enable)`);
    return;
  }

  const subject = `[Uptime Alert] ${type.toUpperCase().replace('_', ' ')} - AI Document Chat`;

  const body = `
Uptime Monitor Alert

Type: ${type.toUpperCase().replace('_', ' ')}
Message: ${message}
Time: ${new Date().toISOString()}

Details:
${Object.entries(details).map(([key, value]) => `  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join('\n')}

---
Uptime Monitor
AI Document Chat
  `.trim();

  // Check if nodemailer is available
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (e) {
    console.log(`📧 Email alert [${type}]: ${message} (nodemailer not installed)`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: CONFIG.alerting.email.smtpHost,
    port: CONFIG.alerting.email.smtpPort,
    secure: CONFIG.alerting.email.smtpPort === 465,
    auth: {
      user: CONFIG.alerting.email.smtpUser,
      pass: CONFIG.alerting.email.smtpPass,
    },
  });

  try {
    await transporter.sendMail({
      from: '"Uptime Monitor" <noreply@aidocumentchat.com>',
      to: CONFIG.alerting.email.alertEmail,
      subject,
      text: body,
    });
    console.log(`✅ Email alert sent to ${CONFIG.alerting.email.alertEmail}`);
  } catch (error) {
    console.error(`⚠️  Failed to send email alert: ${error}`);
  }
}

/**
 * Log message to file
 */
function logMessage(level: string, message: string, data?: Record<string, any>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data && { data }),
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  
  fs.appendFileSync(CONFIG.logFile, logLine);
  console.log(`📝 [${level}] ${message}`);
}

/**
 * Save metrics to file
 */
function saveMetrics() {
  const metrics = {
    period: {
      start: state.startTime,
      end: new Date(),
    },
    summary: {
      totalChecks: state.totalChecks,
      successfulChecks: state.successfulChecks,
      failedChecks: state.failedChecks,
      uptimePercent: state.totalChecks > 0 
        ? Math.round((state.successfulChecks / state.totalChecks) * 10000) / 100 
        : 100,
    },
    latency: {
      average: state.latencies.length > 0
        ? Math.round(state.latencies.reduce((a, b) => a + b, 0) / state.latencies.length)
        : 0,
      min: state.latencies.length > 0 ? Math.min(...state.latencies) : 0,
      max: state.latencies.length > 0 ? Math.max(...state.latencies) : 0,
      p95: calculatePercentile(95),
      p99: calculatePercentile(99),
    },
    current: {
      isHealthy: state.isHealthy,
      lastSuccess: state.lastSuccess,
      lastFailure: state.lastFailure,
      consecutiveFailures: state.consecutiveFailures,
    },
    alerts: state.alertsSent.slice(-10), // Last 10 alerts
  };

  fs.writeFileSync(CONFIG.metricsFile, JSON.stringify(metrics, null, 2));
}

/**
 * Calculate percentile from latencies
 */
function calculatePercentile(percentile: number): number {
  if (state.latencies.length === 0) return 0;
  
  const sorted = [...state.latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  
  return sorted[Math.max(0, index)];
}

/**
 * Get current status
 */
function getStatus() {
  return {
    isHealthy: state.isHealthy,
    uptime: state.totalChecks > 0 
      ? Math.round((state.successfulChecks / state.totalChecks) * 10000) / 100 
      : 100,
    lastCheck: state.lastSuccess || state.lastFailure,
    metrics: {
      totalChecks: state.totalChecks,
      successfulChecks: state.successfulChecks,
      failedChecks: state.failedChecks,
      averageLatency: state.latencies.length > 0
        ? Math.round(state.latencies.reduce((a, b) => a + b, 0) / state.latencies.length)
        : 0,
    },
  };
}

// Export for programmatic use
export {
  performCheck,
  getStatus,
  saveMetrics,
  CONFIG,
  state,
};

// Run if executed directly
if (require.main === module) {
  startMonitoring().catch(console.error);
}
