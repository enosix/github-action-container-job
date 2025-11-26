import * as core from '@actions/core';
import {DefaultAzureCredential} from '@azure/identity';
import {ContainerAppsAPIClient} from '@azure/arm-appcontainers';

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique job name
 */
function generateJobName(prefix = 'job') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Parse command string into array
 */
function parseCommand(commandString) {
    if (!commandString || commandString.trim() === '') {
        return undefined;
    }
    
    // Simple space-delimited parsing
    return commandString.trim().split(/\s+/);
}

/**
 * Parse JSON input safely
 */
function parseJsonInput(inputName) {
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
 * Create Azure Container App Job
 */
async function createJob(client, resourceGroup, environmentName, jobName, config) {
    core.info(`Creating job: ${jobName}`);
    
    const { image, command, userManagedIdentity, environmentVariables, secrets, cpu, memory, registryServer, registryUsername, registryPassword } = config;
    
    // First, get the managed environment to obtain the location
    let location = 'eastus'; // Default fallback
    try {
        const environment = await client.managedEnvironments.get(resourceGroup, environmentName);
        location = environment.location || 'eastus';
        core.info(`Using location from environment: ${location}`);
    } catch (error) {
        core.warning(`Could not get environment location, using default: ${error.message}`);
    }
    
    // Build environment variables array
    const envVars = [];
    for (const [key, value] of Object.entries(environmentVariables)) {
        envVars.push({
            name: key,
            value: value
        });
    }
    
    // Build secrets array
    const secretsArray = [];
    for (const [key, value] of Object.entries(secrets)) {
        const secretName = key.toLowerCase().replaceAll('_', '-'); // Azure requires lowercase with hyphens

        secretsArray.push({
            name: secretName,
            keyVaultUrl: value,
            identity: userManagedIdentity
        });

        
        // Also add as secret reference in env vars
        envVars.push({
            name: key,
            secretRef: secretName
        });
    }
    
    // Build container configuration
    const container = {
        name: 'main',
        image: image,
        resources: {
            cpu: Number.parseFloat(cpu),
            memory: memory
        },
        env: envVars.length > 0 ? envVars : undefined
    };
    
    if (command) {
        container.command = command;
    }
    
    // Build registries configuration
    const registries = [];
    if (registryServer && registryUsername && registryPassword) {
        registries.push({
            server: registryServer,
            username: registryUsername,
            passwordSecretRef: 'registry-password'
        });
        
        // Add registry password as secret
        secretsArray.push({
            name: 'registry-password',
            value: registryPassword
        });
    }
    
    // Build job configuration
    const jobConfig = {
        location: location,
        properties: {
            environmentId: `/subscriptions/${client.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.App/managedEnvironments/${environmentName}`,
            configuration: {
                triggerType: 'Manual',
                replicaTimeout: 1800,
                replicaRetryLimit: 0,
                manualTriggerConfig: {
                    replicaCompletionCount: 1,
                    parallelism: 1
                },
                secrets: secretsArray.length > 0 ? secretsArray : undefined,
                registries: registries.length > 0 ? registries : undefined
            },
            template: {
                containers: [container]
            }
        }
    };
    
    // Add user-managed identity if provided
    if (userManagedIdentity) {
        jobConfig.identity = {
            type: 'UserAssigned',
            userAssignedIdentities: {
                [userManagedIdentity]: {}
            }
        };
    }
    
    try {
        const result = await client.jobs.beginCreateOrUpdateAndWait(
            resourceGroup,
            jobName,
            jobConfig
        );
        
        core.info(`Job created successfully: ${jobName}`);
        return result;
    } catch (error) {
        throw new Error(`Failed to create job: ${error.message}`);
    }
}

/**
 * Start job execution
 */
async function startJobExecution(client, resourceGroup, jobName) {
    core.info(`Starting job execution: ${jobName}`);
    
    try {
        const execution = await client.jobs.beginStartAndWait(
            resourceGroup,
            jobName,
            {}
        );
        
        core.info(`Job execution started: ${execution.name}`);
        return execution;
    } catch (error) {
        throw new Error(`Failed to start job execution: ${error.message}`);
    }
}

/**
 * Poll for job execution completion
 */
async function pollJobExecution(client, resourceGroup, jobName, executionName, timeout) {
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
            
            const status = execution.properties?.status;
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
 */
async function deleteJob(client, resourceGroup, jobName) {
    core.info(`Deleting job: ${jobName}`);
    
    try {
        await client.jobs.beginDeleteAndWait(resourceGroup, jobName);
        core.info(`Job deleted successfully: ${jobName}`);
    } catch (error) {
        core.warning(`Failed to delete job: ${error.message}`);
    }
}

/**
 * Main function
 */
async function run() {
    let client = null;
    let jobName = null;
    let resourceGroup = null;
    
    try {
        // Get inputs
        const subscriptionId = core.getInput('subscription-id', { required: true });
        resourceGroup = core.getInput('resource-group', { required: true });
        const environmentName = core.getInput('environment-name', { required: true });
        jobName = core.getInput('job-name', { required: false }) || generateJobName('gh-job');
        const image = core.getInput('image', { required: true });
        const commandString = core.getInput('command', { required: false });
        const userManagedIdentity = core.getInput('user-managed-identity', { required: false });
        const cpu = core.getInput('cpu', { required: false }) || '0.5';
        const memory = core.getInput('memory', { required: false }) || '1Gi';
        const timeout = Number.parseInt(core.getInput('timeout', { required: false }) || '1800', 10);
        const registryServer = core.getInput('registry-server', { required: false });
        const registryUsername = core.getInput('registry-username', { required: false });
        const registryPassword = core.getInput('registry-password', { required: false });
        
        // Parse JSON inputs
        const environmentVariables = parseJsonInput('environment-variables');
        const secrets = parseJsonInput('secrets');
        
        // Parse command
        const command = parseCommand(commandString);
        
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
            registryPassword
        });
        
        // Set output for job name
        core.setOutput('job-name', jobName);
        
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
        if (client && resourceGroup && jobName) {
            try {
                await deleteJob(client, resourceGroup, jobName);
            } catch (cleanupError) {
                core.warning(`Failed to cleanup job: ${cleanupError.message}`);
            }
        }
        
        core.setFailed(error.message);
    }
}

export { run, sleep, generateJobName, parseCommand, parseJsonInput };
