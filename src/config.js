/**
 * Azure Container App Job configuration builder
 */
import * as core from '@actions/core';

/**
 * Build Azure Container App Job configuration object
 * @param {string} subscriptionId - Azure subscription ID
 * @param {string} resourceGroup - Resource group name
 * @param {string} environmentName - Container Apps environment name
 * @param {string} location - Azure location
 * @param {object} config - Job configuration
 * @returns {types.Job} Azure Container App Job configuration
 */
export function buildJobConfig(subscriptionId, resourceGroup, environmentName, location, config) {
    const { 
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
        registryIdentity,
        cronSchedule 
    } = config;
    
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

        if (value) {
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
    }
    
    // Build container configuration
    const container = {
        name: 'main',
        image: image,
        resources: {
            cpu: Number.parseFloat(cpu),
            memory: memory
        },
        env: envVars.length > 0 ? envVars : []
    };
    
    if (command) {
        container.command = command;
    }
    
    // Build registries configuration
    const registries = [];
    if (registryServer && registryIdentity) {
        // Managed identity authentication (Entra IAM / ACR with managed identity)
        if (registryUsername || registryPassword) {
            core.warning('Both registry-identity and registry-username/registry-password were provided. Using registry-identity (managed identity) and ignoring username/password.');
        }
        registries.push({
            server: registryServer,
            identity: registryIdentity
        });
    } else if (registryServer && registryUsername && registryPassword) {
        // Username/password authentication
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

    /**
     * @type {JobConfiguration}
     */
    let configuration = {
        replicaTimeout: 1800,
        replicaRetryLimit: 0,
        secrets: secretsArray.length > 0 ? secretsArray : [],
        registries: registries.length > 0 ? registries : []
    }

    if (cronSchedule) {
        configuration.triggerType = 'Schedule';
        configuration.scheduleTriggerConfig = {
            cronExpression: cronSchedule,
            parallelism: 1,
            replicaCompletionCount: 1
        };
    } else {
        configuration.triggerType = 'Manual';
        configuration.manualTriggerConfig = {
            replicaCompletionCount: 1,
            parallelism: 1
        };
    }
    
    // Build job configuration
    /**
     * @type {Job}
     */
    const job = {
        configuration,
        environmentId: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.App/managedEnvironments/${environmentName}`,
        location: location,
        template: {
            containers: [container],
        },
    };

    // Add user-managed identity if provided
    if (userManagedIdentity) {
        job.identity = {
            type: 'UserAssigned',
            userAssignedIdentities: {
                [userManagedIdentity]: {}
            }
        };
    }

    return job;
}
