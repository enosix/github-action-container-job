# GitHub Action: Azure Container App Job

A GitHub Action to create, run, and manage Azure Container App Jobs. This action handles the complete lifecycle of a
container job including creation, execution, log retrieval, and cleanup.

This action defaults to a one-off job execution but can be configured to set up a recurring job by setting the 
`cron-schedule` input.

The action respects the container's exit code - if the container exits with a non-zero code, the action will also fail.

## Usage

### Basic Example

```yaml
- name: Run Azure Container Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    image: ghcr.io/myorg/myimage:latest
```

### Complete Example with All Options

```yaml
- name: Run Azure Container Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    job-name: my-custom-job-name
    image: ghcr.io/myorg/myimage:latest
    command: python script.py --arg1 value1
    user-managed-identity: /subscriptions/.../resourcegroups/.../providers/Microsoft.ManagedIdentity/userAssignedIdentities/my-identity
    environment-variables: '{"VAR1": "value1", "VAR2": "value2"}'
    secrets: '{"SECRET1": "${{ secrets.MY_SECRET }}"}'
    cpu: "1.0"
    memory: "2Gi"
    timeout: "3600"
    registry-server: ghcr.io
    registry-username: ${{ github.actor }}
    registry-password: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

### Required Inputs

| Input              | Description                                              |
|--------------------|----------------------------------------------------------|
| `subscription-id`  | Azure subscription ID                                    |
| `resource-group`   | Azure resource group name                                |
| `environment-name` | Azure Container App Environment name                     |
| `image`            | Container image to use (e.g., `ghcr.io/owner/image:tag`) |

### Optional Inputs

| Input                       | Description                                                     | Default                       |
|-----------------------------|-----------------------------------------------------------------|-------------------------------|
| `job-name`                  | Name for the container app job (auto-generated if not provided) | `gh-job-{timestamp}-{random}` |
| `command`                   | Space-delimited command to run in the container                 | Container default             |
| `user-managed-identity`     | Resource ID of user-managed identity to assign to the job       | None                          |
| `environment-variables`     | JSON object of environment variables                            | `{}`                          |
| `secrets`                   | JSON object of secret URIs                                      | `{}`                          |
| `cron-schedule`             | Cron schedule for recurring jobs (optional)                     | None                          |
| `manual-execution`          | Create a manually triggered job without running it immediately  | `false`                       |
| `only-delete-job`           | Only delete the job without creating or running it              | `false`                       |
| `dry-run`                   | Preview payload and skip Azure calls                            | `false`                       |
| `cpu`                       | CPU cores to allocate (e.g., "0.5", "1.0")                      | `0.5`                         |
| `memory`                    | Memory to allocate (e.g., "1Gi", "2Gi")                         | `1Gi`                         |
| `timeout`                   | Job execution timeout in seconds                                | `1800` (30 minutes)           |
| `registry-server`           | Container registry server (e.g., ghcr.io)                       | None                          |
| `registry-username`         | Container registry username                                     | None                          |
| `registry-password`         | Container registry password                                     | None                          |
| `log-analytics-workspace-id`| Log Analytics Workspace ID for retrieving container logs        | None                          |

## Outputs

| Output           | Description                               |
|------------------|-------------------------------------------|
| `job-name`       | Name of the created job                   |
| `execution-name` | Name of the job execution                 |

## Authentication

This action uses the [DefaultAzureCredential](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential) from the Azure SDK, which supports authentication using `azure/login`

```yaml
- name: Azure Login
  uses: azure/login@v1
  with:
    creds: ${{ secrets.AZURE_CREDENTIALS }}

- name: Run Container Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    image: myimage:latest
```
## Private Container Registries

### GitHub Container Registry (ghcr.io)

```yaml
- name: Run Container Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    image: ghcr.io/myorg/myimage:latest
    registry-server: ghcr.io
    registry-username: ${{ github.actor }}
    registry-password: ${{ secrets.GITHUB_TOKEN }}
```

## Environment Variables and Secrets

Environment variables are passed as plain text, while secrets refer to the Azure Key Vault URLs, and will be 
automatically decrypted and added to the environment during runtime.

```yaml
- name: Run Container Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    image: myimage:latest
    user-managed-identity: /subscriptions/.../resourcegroups/.../providers/Microsoft.ManagedIdentity/userAssignedIdentities/my-identity
    environment-variables: |
      {
        "LOG_LEVEL": "debug",
        "API_URL": "https://api.example.com"
      }
    secrets: |
      {
        "API_KEY": "https://myvault.vault.azure.net/secrets/API_KEY",
        "DATABASE_PASSWORD": "https://myvault.vault.azure.net/secrets/DATABASE_PASSWORD"
      }
```

## Container Logs

The action can automatically retrieve and display container logs from Azure Log Analytics after the job completes. 
To enable this feature, provide the Log Analytics Workspace ID that is configured with your Container App Environment.

```yaml
- name: Run Container Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    image: myimage:latest
    log-analytics-workspace-id: ${{ secrets.LOG_ANALYTICS_WORKSPACE_ID }}
```

**Note:** Logs may take a few minutes to appear in Log Analytics after job execution. If no logs are found immediately, 
they should be available in the Azure portal under the Container App Environment's log stream.

## Execution Modes

This action supports multiple execution modes to accommodate different use cases:

### Standard Mode (Default)

By default, the action creates a job, executes it immediately, waits for completion, retrieves logs, and then deletes 
the job.

```yaml
- name: Run Container Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    image: myimage:latest
```

### Scheduled/Recurring Jobs

Set `cron-schedule` to create a recurring job that runs on a schedule. The job will be created but not executed 
immediately, and it will **not** be deleted after creation.

```yaml
- name: Create Scheduled Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    job-name: nightly-cleanup
    image: myimage:latest
    cron-schedule: "0 2 * * *"  # Run daily at 2 AM UTC
```

### Manual Execution Mode

Set `manual-execution: true` to create a job definition without executing it. This is useful when you want to trigger 
the job manually later through Azure Portal, CLI, or API. The job will **not** be deleted after creation.

```yaml
- name: Create Manual Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    job-name: on-demand-task
    image: myimage:latest
    manual-execution: true
```

### Delete Only Mode

Set `only-delete-job: true` to delete an existing job without creating or running anything. 
This is useful for cleanup workflows.

```yaml
- name: Delete Existing Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    job-name: job-to-delete
    only-delete-job: true
```

**Note:** When `only-delete-job` is set, only `subscription-id`, `resource-group`, and `job-name` are required. 
All other inputs are ignored.

### Dry Run Mode

Set `dry-run: true` to preview the job configuration and test the connection to Azure without making any changes.

```yaml
- name: Preview Job Configuration
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    image: myimage:latest
    dry-run: true
```

