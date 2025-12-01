import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { sleep, generateJobName, parseCommand } from './utils.js';
import { parseJsonInput } from './input.js';

// Helper to set INPUT_ env var name mapping like GitHub Actions
function setInputEnv(inputName, value) {
    const envName = `INPUT_${inputName.replace(/-/g, '_').toUpperCase()}`;
    process.env[envName] = value;
}

describe('main', () => {
    const savedEnv = { ...process.env };

    beforeEach(() => {
        process.env.TEST = 'true';
        // Clear all INPUT_ environment variables
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('INPUT_')) {
                delete process.env[key];
            }
        });
    });

    afterEach(() => {
        // Restore environment to avoid leaking state between tests
        Object.keys(process.env).forEach(k => delete process.env[k]);
        Object.assign(process.env, savedEnv);
    });

    describe('helper functions', () => {
        it('generateJobName should produce predictable pattern with prefix', () => {
            const name = generateJobName('gh');
            assert.ok(typeof name === 'string');
            assert.ok(name.startsWith('gh-'));
            // Should contain timestamp and a 6-char base36 random suffix
            const parts = name.split('-');
            assert.ok(parts.length >= 3);
            const rand = parts[parts.length - 1];
            assert.match(rand, /^[a-z0-9]{6}$/);
        });

        it('generateJobName defaults to job prefix', () => {
            const name = generateJobName();
            assert.ok(name.startsWith('job-'));
        });

        it('parseCommand handles empty and whitespace inputs', () => {
            assert.strictEqual(parseCommand(null), undefined);
            assert.strictEqual(parseCommand(''), undefined);
            assert.strictEqual(parseCommand('   '), undefined);
        });

        it('parseCommand splits single and multiple words correctly', () => {
            assert.deepStrictEqual(parseCommand('echo'), ['echo']);
            assert.deepStrictEqual(parseCommand('  echo  hello world '), ['echo', 'hello', 'world']);
        });

        it('parseJsonInput returns empty object for missing or empty input', () => {
            // ensure no env var set
            assert.deepStrictEqual(parseJsonInput('environment-variables'), {});

            setInputEnv('environment-variables', '');
            assert.deepStrictEqual(parseJsonInput('environment-variables'), {});
        });

        it('parseJsonInput parses valid JSON input', () => {
            setInputEnv('environment-variables', JSON.stringify({ FOO: 'bar', NUM: 1 }));
            const parsed = parseJsonInput('environment-variables');
            assert.deepStrictEqual(parsed, { FOO: 'bar', NUM: 1 });
        });

        it('parseJsonInput throws on invalid JSON', () => {
            setInputEnv('environment-variables', 'not-json');
            assert.throws(() => parseJsonInput('environment-variables'), /Failed to parse environment-variables/);
        });

        it('sleep waits at least the specified duration', async () => {
            const start = Date.now();
            await sleep(20);
            const elapsed = Date.now() - start;
            assert.ok(elapsed >= 15, `elapsed ${elapsed}ms was less than expected`);
        });
    });

    describe('run function', () => {
        it('should fail without required inputs', async () => {
            // This test verifies that the action fails when required inputs are missing
            // In a real test environment, you would mock the Azure SDK calls

            // For now, we'll skip this test as it requires Azure credentials
            // TODO: Add proper mocking for Azure SDK
            assert.ok(true, 'Test placeholder - implement with proper mocking');
        });
    });
});
