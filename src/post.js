import * as core from '@actions/core';
import { dumpJobLogs } from './utils.js';

function shouldFetchJobLogs(shouldFetch, jobName) {
    return shouldFetch === 'true' && Boolean(jobName);
}

async function runPost() {
    const shouldFetch = core.getState('should-fetch-job-logs');
    const jobName = core.getState('job-name');

    if (!shouldFetchJobLogs(shouldFetch, jobName)) {
        core.info('Skipping job log retrieval.');
        return;
    }

    await dumpJobLogs(core.getState('log-analytics-workspace-id'), jobName);
}

runPost();

export { runPost, shouldFetchJobLogs };
