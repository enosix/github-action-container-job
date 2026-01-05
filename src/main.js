import * as core from '@actions/core';
import { DefaultAzureCredential } from '@azure/identity';
import { ContainerAppsAPIClient } from '@azure/arm-appcontainers';
import { generateJobName, dumpJobLogs } from './utils.js';
import { getInputs } from './input.js';
import { createJob, startJobExecution, pollJobExecution, deleteJob } from './job.js';

/**
 * Main function
 */
async function run() {
    let client = null;
    let jobName = null;
    let resourceGroup = null;
    let keepJob = null;
    let dryRun = false;
    let status = null;
    let exitCode = 0;
    
    try {
        // Get inputs
        const inputs = getInputs();

        // Destructure inputs
        const {
            subscriptionId,
            environmentName,
            timeout,
            logAnalyticsWorkspaceId,
            action,
            containerConfig
        } = inputs;

        jobName = inputs.jobName || generateJobName('gh-job');
        resourceGroup = inputs.resourceGroup;
        keepJob = inputs.keepJob;
        dryRun = inputs.dryRun;
        
        core.info('=== Azure Container App Job Configuration ===');
        core.info(`Subscription: ${subscriptionId}`);
        core.info(`Resource Group: ${resourceGroup}`);
        core.info(`Environment: ${environmentName}`);
        core.info(`Job Name: ${jobName}`);
        core.info(`Image: ${containerConfig.image}`);
        core.info(`Command: ${containerConfig.command ? containerConfig.command.join(' ') : 'default'}`);
        core.info(`Timeout: ${timeout}s`);
        core.info(`Run type: ${action} ${dryRun ? '[Dry Run]' : ''}`);

        // Authenticate with Azure
        core.info('Authenticating with Azure...');
        const credential = new DefaultAzureCredential();
        client = new ContainerAppsAPIClient(credential, subscriptionId);

        if (action === 'delete') {
            await deleteJob(client, resourceGroup, jobName, dryRun);
            return;
        }

        // Create job
        await createJob(client, resourceGroup, environmentName, jobName, containerConfig, dryRun);
        
        // Set output for job name
        core.setOutput('job-name', jobName);

        if (action === 'create') {
            core.info('Job created successfully.');
            return;
        }

        if (action === 'run' && dryRun) {
            core.info('Dry run mode enabled, skipping job execution');
            return;

        } else if (action === 'run') {
            // Start job execution
            const execution = await startJobExecution(client, resourceGroup, jobName);
            const executionName = execution.name;

            // Set output for execution name
            core.setOutput('execution-name', executionName);

            // Poll for completion
            const finalExecution = await pollJobExecution(client, resourceGroup, jobName, executionName, timeout);

            // Check execution status
            status = finalExecution.properties?.status;
            exitCode = finalExecution.properties?.template?.containers?.[0]?.exitCode || 0;

            core.info(`=== Job Completed ===`);
            core.info(`Status: ${status}`);
            core.info(`Exit Code: ${exitCode}`);

            // Dump logs from Log Analytics if workspace ID is provided
            await dumpJobLogs(logAnalyticsWorkspaceId, jobName);
        }

        // Delete job
        if (!keepJob) {
            await deleteJob(client, resourceGroup, jobName, dryRun);
        }
        
        // Fail if job failed
        if (status === 'Failed' || exitCode !== 0) {
            core.setFailed(`Job execution failed with exit code: ${exitCode}`);
        }
        
    } catch (error) {
        core.error(`Error: ${error.message}`);
        core.error(error.stack);
        
        // Attempt cleanup
        if (client && resourceGroup && jobName && !keepJob) {
            try {
                await deleteJob(client, resourceGroup, jobName, dryRun);
            } catch (cleanupError) {
                core.warning(`Failed to cleanup job: ${cleanupError.message}`);
            }
        }
        
        core.setFailed(error.message);
    }
}

export { run };
