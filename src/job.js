import * as core from '@actions/core';
import { sleep, normalizeAzureLocation } from './utils.js';
import { buildJobConfig } from './config.js';

/**
 * Create Azure Container App Job
 * @param {object} client - Azure Container Apps API client
 * @param {string} resourceGroup - Resource group name
 * @param {string} environmentName - Container Apps environment name
 * @param {string} jobName - Job name
 * @param {object} config - Job configuration
 * @returns {Promise<object>} Created job
 */
export async function createJob(client, resourceGroup, environmentName, jobName, config) {
    core.info(`Creating job: ${jobName}`);

    // First, get the managed environment to obtain the location
    let location = 'eastus'; // Default fallback
    try {
        const environment = await client.managedEnvironments.get(resourceGroup, environmentName);
        // Normalize location to avoid service validation issues
        location = normalizeAzureLocation(environment.location) || 'eastus';
        core.info(`Using location from environment: ${environment.location} -> ${location}`);
    } catch (error) {
        core.warning(`Could not get environment location, using default: ${error.message}`);
    }

    // Build the job configuration using the shared function
    const jobConfig = buildJobConfig(client.subscriptionId, resourceGroup, environmentName, location, config);

    try {
        const result = await client.jobs.beginCreateOrUpdateAndWait(
            resourceGroup,
            jobName,
            jobConfig
        );
        
        core.info(`Job created successfully: ${jobName}`);
        return result;
    } catch (error) {
        // Provide more context on failure
        core.error('Azure rejected job create with error:');
        core.error(error?.message || String(error));
        throw new Error(`Failed to create job: ${error.message}`);
    }
}

/**
 * Start job execution
 * @param {object} client - Azure Container Apps API client
 * @param {string} resourceGroup - Resource group name
 * @param {string} jobName - Job name
 * @returns {Promise<object>} Job execution
 */
export async function startJobExecution(client, resourceGroup, jobName) {
    core.info(`Starting job execution: ${jobName}`);
    
    try {
        const execution = await client.jobs.beginStartAndWait(
            resourceGroup,
            jobName,
            {
                updateIntervalInMs: 5000
            }
        );
        
        core.info(`Job execution started: ${execution.name}`);
        return execution;
    } catch (error) {
        throw new Error(`Failed to start job execution: ${error.message}`);
    }
}

/**
 * Poll for job execution completion
 * @param {object} client - Azure Container Apps API client
 * @param {string} resourceGroup - Resource group name
 * @param {string} jobName - Job name
 * @param {string} executionName - Execution name
 * @param {number} timeout - Timeout in seconds
 * @returns {Promise<object>} Final job execution status
 */
export async function pollJobExecution(client, resourceGroup, jobName, executionName, timeout) {
    core.info(`Polling for job completion (timeout: ${timeout}s)`);
    
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;
    const pollInterval = 10000; // 10 seconds
    
    while (true) {
        const elapsed = Date.now() - startTime;
        
        if (elapsed > timeoutMs) {
            throw new Error(`Job execution timed out after ${timeout} seconds`);
        }
        
        try {
            const execution = await client.jobExecution(resourceGroup, jobName, executionName);
            
            const status = execution?.status;
            core.info(`Job status: ${status}`);
            
            if (status === 'Succeeded' || status === 'Failed') {
                return execution;
            }
        } catch (error) {
            core.warning(`Error polling job status: ${error.message}`);
        }
        
        await sleep(pollInterval);
    }
}

/**
 * Delete the job
 * @param {object} client - Azure Container Apps API client
 * @param {string} resourceGroup - Resource group name
 * @param {string} jobName - Job name
 * @returns {Promise<void>}
 */
export async function deleteJob(client, resourceGroup, jobName) {
    core.info(`Deleting job: ${jobName}`);
    
    try {
        await client.jobs.beginDeleteAndWait(resourceGroup, jobName);
        core.info(`Job deleted successfully: ${jobName}`);
    } catch (error) {
        core.warning(`Failed to delete job: ${error.message}`);
    }
}
