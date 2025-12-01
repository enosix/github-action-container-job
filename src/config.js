/**
 * Azure Container App Job configuration builder
 */

/**
 * Build Azure Container App Job configuration object
 * @param {string} subscriptionId - Azure subscription ID
 * @param {string} resourceGroup - Resource group name
 * @param {string} environmentName - Container Apps environment name
 * @param {string} location - Azure location
 * @param {object} config - Job configuration
 * @returns {object} Azure Container App Job configuration
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

    // Build trigger configuration based on cron schedule
    let triggerType;
    let triggerConfig = {};

    if (cronSchedule) {
        triggerType = 'Schedule';
        triggerConfig.scheduleTriggerConfig = {
            cronExpression: cronSchedule,
            parallelism: 1,
            replicaCompletionCount: 1
        };
    } else {
        triggerType = 'Manual';
        triggerConfig.manualTriggerConfig = {
            replicaCompletionCount: 1,
            parallelism: 1
        };
    }
    
    // Build job configuration
    const jobConfig = {
        configuration: {
            triggerType: triggerType,
            replicaTimeout: 1800,
            replicaRetryLimit: 0,
            ...triggerConfig,
            secrets: secretsArray.length > 0 ? secretsArray : [],
            registries: registries.length > 0 ? registries : []
        },
        environmentId: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.App/managedEnvironments/${environmentName}`,
        location: location,
        workLoadProfileName: 'Consumption',
        template: {
            containers: [container],
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

    return jobConfig;
}
