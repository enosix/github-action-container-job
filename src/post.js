import * as core from '@actions/core';
import { dumpJobLogs } from './utils.js';

function shouldFetchJobLogs(shouldFetch, jobName) {
    return shouldFetch === 'true' && Boolean(jobName);
}

async function runPost() {
    const shouldFetch = core.getState('should-fetch-job-logs');
    const jobName = core.getState('job-name');
    const executionName = core.getState('execution-name');
    const workspaceId = core.getState('log-analytics-workspace-id');

    if (!shouldFetchJobLogs(shouldFetch, jobName)) {
        core.info('Skipping job log retrieval.');
        return;
    }

    await dumpJobLogs(workspaceId, jobName, executionName);
}

runPost();

export { runPost, shouldFetchJobLogs };
