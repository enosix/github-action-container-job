import * as core from '@actions/core';
import { parseCommand } from './utils.js';

/**
 * Parse JSON input safely
 * @param {string} inputName - Name of the input to parse
 * @returns {object} Parsed JSON object or empty object
 */
export function parseJsonInput(inputName) {
    // Try using @actions/core first
    let input = '';
    try {
        input = core.getInput(inputName, { required: false }) || '';
    } catch (err) {
        console.log(`core.getInput failed for ${inputName}: ${err.message}`);
        input = '';
    }

    // Fallback: read directly from environment (helpful in unit tests)
    if (!input || input.trim() === '') {
        const envName = `INPUT_${inputName.replaceAll('-', '_').toUpperCase()}`;
        input = process.env[envName] || '';
    }

    if (!input || input.trim() === '') {
        return {};
    }
    
    try {
        return JSON.parse(input);
    } catch (error) {
        throw new Error(`Failed to parse ${inputName}: ${error.message}`);
    }
}

/**
 * Get all action inputs
 * @returns {object} All parsed inputs
 */
export function getInputs() {
    const subscriptionId = core.getInput('subscription-id', { required: true });
    const resourceGroup = core.getInput('resource-group', { required: true });
    const environmentName = core.getInput('environment-name', { required: true });
    const jobName = core.getInput('job-name', { required: false });
    const image = core.getInput('image', { required: true });
    const commandString = core.getInput('command', { required: false });
    const userManagedIdentity = core.getInput('user-managed-identity', { required: false });
    const cronSchedule = core.getInput('cron-schedule', { required: false });
    const cpu = core.getInput('cpu', { required: false }) || '0.5';
    const memory = core.getInput('memory', { required: false }) || '1Gi';
    const timeout = Number.parseInt(core.getInput('timeout', { required: false }) || '1800', 10);
    const registryServer = core.getInput('registry-server', { required: false });
    const registryUsername = core.getInput('registry-username', { required: false });
    const registryPassword = core.getInput('registry-password', { required: false });
    const dryRun = (core.getInput('dry-run', { required: false }) || '').toLowerCase() === 'true';
    const logAnalyticsWorkspaceId = core.getInput('log-analytics-workspace-id', { required: false });

    // Parse JSON inputs
    const environmentVariables = parseJsonInput('environment-variables');
    const secrets = parseJsonInput('secrets');
    
    // Parse command
    const command = parseCommand(commandString);

    return {
        subscriptionId,
        resourceGroup,
        environmentName,
        jobName,
        image,
        command,
        userManagedIdentity,
        cronSchedule,
        cpu,
        memory,
        timeout,
        registryServer,
        registryUsername,
        registryPassword,
        dryRun,
        logAnalyticsWorkspaceId,
        environmentVariables,
        secrets
    };
}
