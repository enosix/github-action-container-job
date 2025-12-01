/**
 * Utility functions for Azure Container App Job GitHub Action
 */

import * as core from '@actions/core';
import { DefaultAzureCredential } from '@azure/identity';
import { LogsQueryClient } from '@azure/monitor-query';

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique job name
 * @param {string} prefix - Prefix for the job name
 * @returns {string} Generated job name
 */
export function generateJobName(prefix = 'job') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Parse command string into array
 * @param {string} commandString - Command string to parse
 * @returns {string[]|undefined} Parsed command array or undefined
 */
export function parseCommand(commandString) {
    if (!commandString || commandString.trim() === '') {
        return undefined;
    }
    
    // Simple space-delimited parsing
    return commandString.trim().split(/\s+/);
}

/**
 * Normalize Azure location to canonical format (e.g., 'East US' -> 'eastus')
 * @param {string} location - Azure location string
 * @returns {string} Normalized location
 */
export function normalizeAzureLocation(location) {
    if (!location) return 'eastus';
    return String(location).toLowerCase().replaceAll(/\s+/g, '');
}

/**
 * Query and dump container app job logs from Log Analytics
 * @param {string} workspaceId - Log Analytics Workspace ID
 * @param {string} jobName - Container job name to filter logs
 * @returns {Promise<void>}
 */
export async function dumpJobLogs(workspaceId, jobName) {
    if (!workspaceId || workspaceId.trim() === '') {
        core.info('No Log Analytics Workspace ID provided, skipping log dump');
        return;
    }

    try {
        core.info('Querying container job logs from Log Analytics...');
        
        const credential = new DefaultAzureCredential();
        const logsClient = new LogsQueryClient(credential);
        
        // Query logs from the last hour to ensure we capture all logs from the job run
        const query = `
            ContainerAppConsoleLogs_CL
            | where ContainerJobName_s == "${jobName}"
            | order by TimeGenerated asc
            | project TimeGenerated, Log_s
        `;
        
        const result = await logsClient.queryWorkspace(
            workspaceId,
            query,
            { duration: 'PT1H' }
        );
        
        if (result.status === 'Success' && result.tables && result.tables.length > 0) {
            const table = result.tables[0];
            const logCount = table.rows.length;
            
            if (logCount === 0) {
                core.info('No logs found for this job. Logs may take a few minutes to appear in Log Analytics.');
                return;
            }
            
            core.info(`\n========== Container Job Logs (${logCount} entries) ==========`);
            
            for (const row of table.rows) {
                const timestamp = row[0];
                const logMessage = row[1];
                core.info(`[${timestamp}] ${logMessage}`);
            }
            
            core.info('========== End of Logs ==========\n');
        } else if (result.status === 'PartialError') {
            core.warning('Partial error retrieving logs:');
            for (const error of result.partialError) {
                core.warning(error.message);
            }
        } else {
            core.warning('No logs returned from query');
        }
        
    } catch (error) {
        core.warning(`Failed to retrieve logs from Log Analytics: ${error.message}`);
        core.info('Note: Logs can take several minutes to appear in Log Analytics after job execution');
    }
}
