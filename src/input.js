import * as core from '@actions/core';
import { parseCommand } from './utils.js';

/**
 * Get input safely with fallback for tests
 * @param {string} name - Input name
 * @param {object} options - Input options
 * @returns {string} Input value
 */
export function getInput(name, options = {}) {
    let val = '';
    try {
        val = core.getInput(name, { required: false });
    } catch (error) {
        core.debug(`core.getInput failed for ${name}: ${error.message}`);
        // ignore error from core
    }

    if (!val) {
        // Fallback: read directly from environment (helpful in unit tests)
        const envName = `INPUT_${name.replaceAll('-', '_').toUpperCase()}`;
        val = process.env[envName] || '';
    }

    if (options.required && !val) {
        throw new Error(`Input required and not supplied: ${name}`);
    }

    return val;
}

/**
 * Parse JSON input safely
 * @param {string} inputName - Name of the input to parse
 * @returns {object} Parsed JSON object or empty object
 */
export function parseJsonInput(inputName) {
    const input = getInput(inputName, { required: false });

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
    const subscriptionId = getInput('subscription-id', { required: true });
    const resourceGroup = getInput('resource-group', { required: true });
    const environmentName = getInput('environment-name', { required: true });
    const jobName = getInput('job-name', { required: false });
    const image = getInput('image', { required: false });
    const commandString = getInput('command', { required: false });
    const userManagedIdentity = getInput('user-managed-identity', { required: false });
    const cronSchedule = getInput('cron-schedule', { required: false });
    const cpu = getInput('cpu', { required: false }) || '0.5';
    const memory = getInput('memory', { required: false }) || '1Gi';
    const timeout = Number.parseInt(getInput('timeout', { required: false }) || '1800', 10);
    const registryServer = getInput('registry-server', { required: false });
    const registryUsername = getInput('registry-username', { required: false });
    const registryPassword = getInput('registry-password', { required: false });
    const dryRun = (getInput('dry-run', { required: false }) || '').toLowerCase() === 'true';
    const logAnalyticsWorkspaceId = getInput('log-analytics-workspace-id', { required: false });
    const manualExecution = (getInput('manual-execution', { required: false }) || '').toLowerCase() === 'true';
    const onlyDeleteJob = (getInput('only-delete-job', { required: false }) || '').toLowerCase() === 'true';

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
        manualExecution,
        onlyDeleteJob,
        environmentVariables,
        secrets
    };
}
