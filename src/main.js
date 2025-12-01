import * as core from '@actions/core';
import { DefaultAzureCredential } from '@azure/identity';
import { ContainerAppsAPIClient } from '@azure/arm-appcontainers';
import { generateJobName, dumpJobLogs } from './utils.js';
import { getInputs } from './input.js';
import { buildJobConfig } from './config.js';
import { createJob, startJobExecution, pollJobExecution, deleteJob } from './job.js';

/**
 * Main function
 */
async function run() {
    let client = null;
    let jobName = null;
    let resourceGroup = null;
    let cronSchedule = null;
    
    try {
        // Get inputs
        const inputs = getInputs();
        
        // Destructure inputs
        const {
            subscriptionId,
            environmentName,
            image,
            command,
            userManagedIdentity,
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
        } = inputs;
        
        resourceGroup = inputs.resourceGroup;
        jobName = inputs.jobName || generateJobName('gh-job');
        cronSchedule = inputs.cronSchedule;
        
        core.info('=== Azure Container App Job Configuration ===');
        core.info(`Subscription: ${subscriptionId}`);
        core.info(`Resource Group: ${resourceGroup}`);
        core.info(`Environment: ${environmentName}`);
        core.info(`Job Name: ${jobName}`);
        core.info(`Image: ${image}`);
        core.info(`Command: ${command ? command.join(' ') : 'default'}`);
        core.info(`CPU: ${cpu}`);
        core.info(`Memory: ${memory}`);
        core.info(`Timeout: ${timeout}s`);
        core.info(`Dry Run: ${dryRun}`);

        if (dryRun) {
            // Build the same job config that would be used in actual execution
            const jobConfig = buildJobConfig(subscriptionId, resourceGroup, environmentName, 'eastus', {
                image,
                command,
                userManagedIdentity,
                environmentVariables,
                secrets,
                cpu,
                memory,
                registryServer,
                registryUsername,
                registryPassword,
                cronSchedule
            });

            core.info('Dry-run preview of job payload:');
            core.info(JSON.stringify(jobConfig, null, 2));
            core.setOutput('job-name', jobName);
            core.info('Dry run mode enabled, skipping Azure API calls.');
            return;
        }

        // Authenticate with Azure
        core.info('Authenticating with Azure...');
        const credential = new DefaultAzureCredential();
        client = new ContainerAppsAPIClient(credential, subscriptionId);
        
        // Create job
        await createJob(client, resourceGroup, environmentName, jobName, {
            image,
            command,
            userManagedIdentity,
            environmentVariables,
            secrets,
            cpu,
            memory,
            registryServer,
            registryUsername,
            registryPassword,
            cronSchedule
        });
        
        // Set output for job name
        core.setOutput('job-name', jobName);

        if (cronSchedule) {
            core.info('Cron schedule provided, skipping execution start.');
            return;
        }
        
        // Start job execution
        const execution = await startJobExecution(client, resourceGroup, jobName);
        const executionName = execution.name;
        
        // Set output for execution name
        core.setOutput('execution-name', executionName);
        
        // Poll for completion
        const finalExecution = await pollJobExecution(client, resourceGroup, jobName, executionName, timeout);

        // Check execution status
        const status = finalExecution.properties?.status;
        const exitCode = finalExecution.properties?.template?.containers?.[0]?.exitCode || 0;
        
        core.info(`=== Job Completed ===`);
        core.info(`Status: ${status}`);
        core.info(`Exit Code: ${exitCode}`);
        
        // Dump logs from Log Analytics if workspace ID is provided
        await dumpJobLogs(logAnalyticsWorkspaceId, jobName);
        
        // Delete job
        await deleteJob(client, resourceGroup, jobName);
        
        // Fail if job failed
        if (status === 'Failed' || exitCode !== 0) {
            core.setFailed(`Job execution failed with exit code: ${exitCode}`);
        }
        
    } catch (error) {
        core.error(`Error: ${error.message}`);
        core.error(error.stack);
        
        // Attempt cleanup
        if (client && resourceGroup && jobName && !cronSchedule) {
            try {
                await deleteJob(client, resourceGroup, jobName);
            } catch (cleanupError) {
                core.warning(`Failed to cleanup job: ${cleanupError.message}`);
            }
        }
        
        core.setFailed(error.message);
    }
}

export { run };
