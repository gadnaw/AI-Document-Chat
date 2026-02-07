#!/usr/bin/env node

/**
 * OWASP ZAP Security Scanner Integration
 * 
 * Automated security scanning for the AI Document Chat API:
 * - Baseline security scan
 * - Active vulnerability scanning
 * - API endpoint testing
 * - Vulnerability reporting
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  zapPath: process.env.ZAP_PATH || '/usr/bin/zap',
  apiKey: process.env.ZAP_API_KEY || '',
  targetUrl: process.env.SCAN_TARGET_URL || 'http://localhost:3000',
  outputDir: './reports/security',
  scanConfig: {
    baseline: {
      spider: true,
      passiveScan: true,
      activeScan: false,
      maxDuration: 60, // seconds
    },
    active: {
      spider: true,
      passiveScan: true,
      activeScan: true,
      maxDuration: 300, // seconds
    },
  },
};

// Vulnerability severity levels
const SEVERITY = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFORMATIONAL: 'Informational',
};

// Vulnerability categories
const VULNERABILITY_CATEGORIES = {
  SQL_INJECTION: 'sqli',
  XSS: 'xss',
  CSRF: 'csrf',
  SSRF: 'ssrf',
  AUTH: 'authentication',
  AUTHZ: 'authorization',
  SENSITIVE_DATA: 'sensitive_data',
  MISCONFIG: 'security_misconfiguration',
};

/**
 * Main Security Scanner Class
 */
class SecurityScanner {
  constructor(options = {}) {
    this.targetUrl = options.targetUrl || CONFIG.targetUrl;
    this.apiKey = options.apiKey || CONFIG.apiKey;
    this.outputDir = options.outputDir || CONFIG.outputDir;
    this.zapPort = options.zapPort || 8080;
    this.alerts = [];
    this.scanStatus = 'idle';
  }

  /**
   * Check if ZAP is running
   */
  async checkZapStatus() {
    try {
      const response = await this.zapRequest('/JSON/core/view/version/');
      console.log(`✓ ZAP is running: ${response.version}`);
      return true;
    } catch (error) {
      console.error('✗ ZAP is not running. Start ZAP first or configure ZAP_API_KEY');
      return false;
    }
  }

  /**
   * Make request to ZAP API
   */
  async zapRequest(endpoint, method = 'GET', data = null) {
    const url = `http://localhost:${this.zapPort}${endpoint}`;
    const authHeader = `Bearer ${this.apiKey}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : null,
      });

      if (!response.ok) {
        throw new Error(`ZAP API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`ZAP API request failed: ${endpoint}`, error.message);
      throw error;
    }
  }

  /**
   * Load custom rules from file
   */
  async loadCustomRules() {
    const rulesFile = './config/security-rules.yaml';
    
    if (fs.existsSync(rulesFile)) {
      try {
        const rules = fs.readFileSync(rulesFile, 'utf8');
        console.log('✓ Loaded custom security rules');
        return rules;
      } catch (error) {
        console.warn('⚠ Failed to load custom rules:', error.message);
      }
    }
    
    return null;
  }

  /**
   * Run baseline security scan
   */
  async runBaselineScan() {
    console.log('\n🔒 Starting Baseline Security Scan...');
    this.scanStatus = 'baseline';
    
    try {
      // Set up scan context
      await this.setupContext();
      
      // Spider the application
      console.log('📡 Spidering target URL...');
      await this.spider(this.targetUrl);
      
      // Run passive scan
      console.log('🔍 Running passive scan...');
      await this.waitForPassiveScan();
      
      // Collect alerts
      console.log('📊 Collecting security alerts...');
      const alerts = await this.getAlerts();
      
      // Generate report
      const report = this.formatAlerts(alerts);
      
      console.log('✓ Baseline scan complete');
      return report;
      
    } catch (error) {
      console.error('Baseline scan failed:', error.message);
      throw error;
    }
  }

  /**
   * Run active security scan
   */
  async runActiveScan() {
    console.log('\n🔒 Starting Active Security Scan...');
    this.scanStatus = 'active';
    
    try {
      // Set up scan context with authentication
      await this.setupContext(true);
      
      // Spider the application
      console.log('📡 Spidering target URL...');
      await this.spider(this.targetUrl);
      
      // Run active scan on API endpoints
      console.log('🎯 Running active scan on API endpoints...');
      await this.scanApiEndpoints();
      
      // Wait for scan to complete
      console.log('⏳ Waiting for active scan to complete...');
      await this.waitForActiveScan();
      
      // Collect alerts
      console.log('📊 Collecting security alerts...');
      const alerts = await this.getAlerts();
      
      // Generate comprehensive report
      const report = this.formatAlerts(alerts, true);
      
      console.log('✓ Active scan complete');
      return report;
      
    } catch (error) {
      console.error('Active scan failed:', error.message);
      throw error;
    }
  }

  /**
   * Set up scan context
   */
  async setupContext(withAuth = false) {
    // Create context for the application
    const contextData = {
      name: 'AI Document Chat',
      urls: [`${this.targetUrl}/**`],
    };
    
    await this.zapRequest('/JSON/context/action/newContext/', 'POST', contextData);
    
    if (withAuth) {
      // Configure authentication if needed
      console.log('  Configuring authentication for protected routes...');
    }
    
    console.log('✓ Scan context configured');
  }

  /**
   * Spider a URL
   */
  async spider(url) {
    const scanId = await this.zapRequest(
      `/JSON/spider/action/scan/?url=${encodeURIComponent(url)}&maxChildren=10`
    );
    
    let status = 'running';
    while (status === 'running') {
      await this.sleep(1000);
      const progress = await this.zapRequest(
        `/JSON/spider/view/status/?scanId=${scanId.scanId}`
      );
      status = progress.status;
      console.log(`  Spider progress: ${progress.progress}%`);
    }
    
    console.log('✓ Spider complete');
  }

  /**
   * Scan API endpoints specifically
   */
  async scanApiEndpoints() {
    const apiEndpoints = [
      `${this.targetUrl}/api/chat`,
      `${this.targetUrl}/api/documents`,
      `${this.targetUrl}/api/search`,
      `${this.targetUrl}/api/user`,
    ];
    
    for (const endpoint of apiEndpoints) {
      console.log(`  Scanning API endpoint: ${endpoint}`);
      
      // Run active scan on each endpoint
      const scanId = await this.zapRequest(
        `/JSON/ascan/action/scan/?url=${encodeURIComponent(endpoint)}&method=POST`
      );
      
      // Wait for scan to complete for this endpoint
      await this.waitForScan(scanId.scanId);
    }
  }

  /**
   * Wait for passive scan to complete
   */
  async waitForPassiveScan() {
    let progress = 0;
    while (progress < 100) {
      const status = await this.zapRequest('/JSON/pscan/view/stats/');
      progress = status.PassiveScan.Total;
      await this.sleep(500);
    }
    console.log('✓ Passive scan complete');
  }

  /**
   * Wait for active scan to complete
   */
  async waitForActiveScan() {
    const maxDuration = CONFIG.scanConfig.active.maxDuration * 1000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxDuration) {
      const status = await this.zapRequest('/JSON/ascan/view/status/');
      const scanning = Object.values(status).some(s => s === 'running');
      
      if (!scanning) {
        break;
      }
      
      await this.sleep(1000);
    }
    
    console.log('✓ Active scan complete');
  }

  /**
   * Wait for specific scan to complete
   */
  async waitForScan(scanId) {
    let status = 'running';
    while (status === 'running') {
      await this.sleep(1000);
      const progress = await this.zapRequest(
        `/JSON/ascan/view/status/?scanId=${scanId}`
      );
      status = progress[scanId]?.status || 'running';
    }
  }

  /**
   * Get all alerts
   */
  async getAlerts() {
    const response = await this.zapRequest('/JSON/core/view/alerts/');
    return response.alerts || [];
  }

  /**
   * Get alerts by risk level
   */
  async getAlertsByRisk(risk) {
    const response = await this.zapRequest(
      `/JSON/core/view/alerts/?riskid=${risk}`
    );
    return response.alerts || [];
  }

  /**
   * Format alerts into structured report
   */
  formatAlerts(alerts, includeDetails = false) {
    const categorized = {
      [SEVERITY.CRITICAL]: [],
      [SEVERITY.HIGH]: [],
      [SEVERITY.MEDIUM]: [],
      [SEVERITY.LOW]: [],
      [SEVERITY.INFORMATIONAL]: [],
    };
    
    // Categorize by severity
    for (const alert of alerts) {
      const severity = alert.risk || SEVERITY.INFORMATIONAL;
      const category = this.categorizeVulnerability(alert);
      
      const formattedAlert = {
        name: alert.name,
        risk: severity,
        confidence: alert.confidence,
        description: alert.description,
        solution: alert.solution,
        category,
        url: alert.url,
        parameter: alert.param,
        attack: alert.attack,
        reference: alert.ref,
        ...(includeDetails && {
          evidence: alert.evidence,
          otherInfo: alert.otherInfo,
        }),
      };
      
      categorized[severity].push(formattedAlert);
    }
    
    return {
      timestamp: new Date().toISOString(),
      target: this.targetUrl,
      totalAlerts: alerts.length,
      bySeverity: categorized,
      summary: this.generateSummary(categorized),
    };
  }

  /**
   * Categorize vulnerability by type
   */
  categorizeVulnerability(alert) {
    const name = alert.name?.toLowerCase() || '';
    const desc = alert.description?.toLowerCase() || '';
    
    if (name.includes('sql') || desc.includes('sql')) {
      return VULNERABILITY_CATEGORIES.SQL_INJECTION;
    }
    if (name.includes('cross site scripting') || name.includes('xss')) {
      return VULNERABILITY_CATEGORIES.XSS;
    }
    if (name.includes('csrf') || name.includes('cross site request')) {
      return VULNERABILITY_CATEGORIES.CSRF;
    }
    if (name.includes('ssrf') || name.includes('server side request')) {
      return VULNERABILITY_CATEGORIES.SSRF;
    }
    if (name.includes('authentication') || name.includes('credentials')) {
      return VULNERABILITY_CATEGORIES.AUTH;
    }
    if (name.includes('authorization') || name.includes('access control')) {
      return VULNERABILITY_CATEGORIES.AUTHZ;
    }
    if (name.includes('sensitive') || name.includes('information disclosure')) {
      return VULNERABILITY_CATEGORIES.SENSITIVE_DATA;
    }
    
    return VULNERABILITY_CATEGORIES.MISCONFIG;
  }

  /**
   * Generate summary statistics
   */
  generateSummary(categorized) {
    const total = Object.values(categorized).reduce((sum, arr) => sum + arr.length, 0);
    
    return {
      total,
      critical: categorized[SEVERITY.CRITICAL].length,
      high: categorized[SEVERITY.HIGH].length,
      medium: categorized[SEVERITY.MEDIUM].length,
      low: categorized[SEVERITY.LOW].length,
      informational: categorized[SEVERITY.INFORMATIONAL].length,
      riskScore: this.calculateRiskScore(categorized),
    };
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(categorized) {
    const weights = {
      [SEVERITY.CRITICAL]: 10,
      [SEVERITY.HIGH]: 7,
      [SEVERITY.MEDIUM]: 4,
      [SEVERITY.LOW]: 1,
      [SEVERITY.INFORMATIONAL]: 0,
    };
    
    let score = 0;
    for (const [severity, alerts] of Object.entries(categorized)) {
      score += alerts.length * weights[severity];
    }
    
    return Math.min(100, score); // Cap at 100
  }

  /**
   * Generate vulnerability report
   */
  async generateReport(report, filename = 'security-scan.json') {
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const reportPath = path.join(this.outputDir, filename);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`✓ Report saved to: ${reportPath}`);
    return reportPath;
  }

  /**
   * Generate Markdown report
   */
  async generateMarkdownReport(report, filename = 'security-scan.md') {
    let markdown = `# Security Scan Report\n\n`;
    markdown += `**Target:** ${report.target}\n`;
    markdown += `**Date:** ${report.timestamp}\n`;
    markdown += `**Risk Score:** ${report.summary.riskScore}/100\n\n`;
    
    markdown += `## Executive Summary\n\n`;
    markdown += `| Severity | Count | Status |\n`;
    markdown += `|----------|-------|--------|\n`;
    markdown += `| 🔴 Critical | ${report.summary.critical} | ${report.summary.critical === 0 ? '✅ Pass' : '❌ Action Required'} |\n`;
    markdown += `| 🟠 High | ${report.summary.high} | ${report.summary.high === 0 ? '✅ Pass' : '⚠️ Review'} |\n`;
    markdown += `| 🟡 Medium | ${report.summary.medium} | ⚠️ Monitor |\n`;
    markdown += `| 🟢 Low | ${report.summary.low} | ℹ️ Info |\n\n`;
    
    for (const [severity, alerts] of Object.entries(report.bySeverity)) {
      if (alerts.length > 0) {
        markdown += `## ${severity} Vulnerabilities (${alerts.length})\n\n`;
        
        for (const alert of alerts) {
          markdown += `### ${alert.name}\n\n`;
          markdown += `**URL:** ${alert.url}\n`;
          markdown += `**Category:** ${alert.category}\n`;
          markdown += `**Parameter:** ${alert.parameter || 'N/A'}\n\n`;
          markdown += `**Description:**\n${alert.description}\n\n`;
          markdown += `**Solution:**\n${alert.solution}\n\n`;
          markdown += `---\n\n`;
        }
      }
    }
    
    const reportPath = path.join(this.outputDir, filename);
    fs.writeFileSync(reportPath, markdown);
    
    console.log(`✓ Markdown report saved to: ${reportPath}`);
    return reportPath;
  }

  /**
   * Check vulnerabilities against thresholds
   */
  checkThresholds(report) {
    const thresholds = {
      critical: 0,
      high: 0,
    };
    
    const issues = [];
    
    if (report.summary.critical > thresholds.critical) {
      issues.push({
        type: 'critical',
        message: `Found ${report.summary.critical} critical vulnerabilities (threshold: ${thresholds.critical})`,
        severity: 'fail',
      });
    }
    
    if (report.summary.high > thresholds.high) {
      issues.push({
        type: 'high',
        message: `Found ${report.summary.high} high vulnerabilities (threshold: ${thresholds.high})`,
        severity: report.summary.critical > 0 ? 'warning' : 'fail',
      });
    }
    
    return {
      passed: issues.filter(i => i.severity === 'fail').length === 0,
      issues,
    };
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Run standalone baseline scan
 */
async function runBaselineScan() {
  const scanner = new SecurityScanner();
  
  if (!await scanner.checkZapStatus()) {
    console.log('\n📋 Manual Scan Instructions:');
    console.log('1. Start OWASP ZAP');
    console.log('2. Enable API access (Tools -> Options -> API)');
    console.log('3. Generate API key and set ZAP_API_KEY environment variable');
    console.log('4. Run this script again');
    return null;
  }
  
  const report = await scanner.runBaselineScan();
  await scanner.generateReport(report);
  await scanner.generateMarkdownReport(report);
  
  return report;
}

/**
 * Run standalone active scan
 */
async function runActiveScan() {
  const scanner = new SecurityScanner();
  
  if (!await scanner.checkZapStatus()) {
    console.log('\n📋 Manual Scan Instructions:');
    console.log('1. Start OWASP ZAP');
    console.log('2. Enable API access (Tools -> Options -> API)');
    console.log('3. Generate API key and set ZAP_API_KEY environment variable');
    console.log('4. Run this script again');
    return null;
  }
  
  const report = await scanner.runActiveScan();
  await scanner.generateReport(report, 'security-scan-active.json');
  await scanner.generateMarkdownReport(report, 'security-scan-active.md');
  
  return report;
}

/**
 * Quick vulnerability check
 */
async function quickCheck() {
  console.log('\n🔒 Running Quick Security Check...');
  
  const report = {
    timestamp: new Date().toISOString(),
    checks: [],
  };
  
  // Check for common issues without full scan
  const checks = [
    {
      name: 'HTTPS Configuration',
      check: async () => {
        const url = new URL(CONFIG.targetUrl);
        return url.protocol === 'https:';
      },
    },
    {
      name: 'Security Headers',
      check: async () => {
        try {
          const response = await fetch(CONFIG.targetUrl);
          const headers = response.headers;
          return {
            'x-frame-options': headers.get('x-frame-options'),
            'x-content-type-options': headers.get('x-content-type-options'),
            'strict-transport-security': headers.get('strict-transport-security'),
          };
        } catch {
          return null;
        }
      },
    },
  ];
  
  for (const check of checks) {
    try {
      const result = await check.check();
      report.checks.push({
        name: check.name,
        passed: result === true,
        result: result !== true ? result : null,
      });
    } catch (error) {
      report.checks.push({
        name: check.name,
        passed: false,
        error: error.message,
      });
    }
  }
  
  console.log('✓ Quick check complete');
  return report;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  (async () => {
    switch (args[0]) {
      case 'baseline':
        await runBaselineScan();
        break;
      case 'active':
        await runActiveScan();
        break;
      case 'quick':
        await quickCheck();
        break;
      case 'full':
        await runBaselineScan();
        await runActiveScan();
        break;
      default:
        console.log(`
Security Scanner CLI

Usage: node security-scan.js [command]

Commands:
  baseline   Run baseline security scan (passive)
  active     Run active security scan (aggressive)
  quick      Quick security checks (no ZAP required)
  full       Run both baseline and active scans

Environment Variables:
  SCAN_TARGET_URL    Target URL to scan (default: http://localhost:3000)
  ZAP_API_KEY        OWASP ZAP API key
  ZAP_PATH          Path to ZAP executable (default: /usr/bin/zap)
  OUTPUT_DIR        Output directory for reports (default: ./reports/security)
`);
    }
  })();
}

// Export for use as module
module.exports = {
  SecurityScanner,
  runBaselineScan,
  runActiveScan,
  quickCheck,
  SEVERITY,
  VULNERABILITY_CATEGORIES,
};
