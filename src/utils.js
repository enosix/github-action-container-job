/**
 * Utility functions for Azure Container App Job GitHub Action
 */

import * as core from '@actions/core';
import * as path from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DefaultArtifactClient } from '@actions/artifact';
import { DefaultAzureCredential } from '@azure/identity';
import { LogsQueryClient } from '@azure/monitor-query-logs';

/**
 * Log additional detail from an Azure SDK RestError (statusCode, code, details, raw response body).
 * Safe to call on any error — non-Azure errors are silently ignored.
 * @param {Error} error - The caught error
 * @param {Function} logFn - core.error or core.warning
 */
export function logAzureErrorDetails(error, logFn = core.warning) {
    if (error?.statusCode) logFn(`HTTP status: ${error.statusCode}`);
    if (error?.code) logFn(`Error code: ${error.code}`);
    if (error?.details) logFn(`Error details: ${JSON.stringify(error.details, null, 2)}`);
    // The Azure LRO poller sometimes fails to extract structured error details from the
    // polling response body (e.g. when code/message are missing). Log the raw body as a fallback.
    const rawBody = error?.response?.bodyAsText ?? error?.response?.parsedBody;
    if (rawBody) logFn(`Raw response body: ${typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody, null, 2)}`);
}

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
        
        const query = `
            ContainerAppConsoleLogs_CL
            | where ContainerJobName_s == "${jobName}"
            | order by TimeGenerated asc
            | project TimeGenerated, Log_s
        `;

        let attempt = 0;
        let result;
        let table = null;

        while (attempt < 6) {
            result = await logsClient.queryWorkspace(
                workspaceId,
                query,
                { duration: 'PT1H' }
            );

            if (result.status === 'Success' && result.tables && result.tables.length > 0) {
                table = result.tables[0];
                if ( table.rows.length > 0) {
                    break;
                }
            }

            attempt++;
            if (attempt < 3) {
                core.info(`No logs found (attempt ${attempt}). Waiting 5 seconds before retrying...`);
                await sleep(5000);
            }
        }

        writeLogs(result, table);
    } catch (error) {
        core.warning(`Failed to retrieve logs from Log Analytics: ${error.message}`);
        logAzureErrorDetails(error, core.warning);
        core.info('Note: Logs can take several minutes to appear in Log Analytics after job execution');
    }
}

function writeLogs(result, table) {
    if (result.status === 'PartialError') {
        core.warning('Partial error retrieving logs:');
        for (const error of result.partialError) {
            core.warning(error.message);
        }
    }

    if (table && table.rows.length > 0) {
        core.info(`\n========== Container Job Logs (${table.rows.length} entries) ==========`);
        for (const row of table.rows) {
            const timestamp = new Date(row[0]).toISOString()
                .replace('T', ' ').split('.')[0];
            const logMessage = row[1];
            core.info(`[${timestamp}] ${logMessage}`);
        }
        core.info('========== End of Logs ==========\n');
    } else {
        core.info('No logs found for this job after 30 seconds. Logs may take a while to appear in Log Analytics.');
    }
}

/**
 * Upload a job definition as an artifact
 * @param {types.Job} jobConfig - Job configuration object
 * @returns {Promise<void>}
 */
export async function uploadJobDefinition(jobConfig) {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'job-def-'));
    try {
        const client = new DefaultArtifactClient();
        const filePath = path.join(tempDir, 'job-definition.json');
        writeFileSync(filePath, JSON.stringify(jobConfig, null, 2), { encoding: 'utf8' });

        // get current time for unique artifact name
        const timestamp = new Date().toISOString()
            .replaceAll(':', '')
            .replaceAll('-', '')
            .split('.')[0];

        const {id, size} = await client.uploadArtifact(
            `job-definition-${timestamp}`,
            [filePath],
            tempDir,
            {}
        );
        core.info(`Uploaded job definition artifact (ID: ${id}, Size: ${size} bytes)`);

    } catch (err) {
        core.setFailed(`Artifact upload failed: ${err?.message || String(err)}`);
    } finally {
        try {
            rmSync(tempDir, { recursive: true, force: true });
        } catch (error_) {
            core.warning(`Failed to cleanup temp files: ${error_.message}`);
        }
    }
}
