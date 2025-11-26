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

| Input                   | Description                                                     | Default                       |
|-------------------------|-----------------------------------------------------------------|-------------------------------|
| `job-name`              | Name for the container app job (auto-generated if not provided) | `gh-job-{timestamp}-{random}` |
| `command`               | Space-delimited command to run in the container                 | Container default             |
| `user-managed-identity` | Resource ID of user-managed identity to assign to the job       | None                          |
| `environment-variables` | JSON object of environment variables                            | `{}`                          |
| `secrets`               | JSON object of secret URIs                                      | `{}`                          |
| `cron-schedule`         | Cron schedule for recurring jobs (optional)                     | None                          |
| `cpu`                   | CPU cores to allocate (e.g., "0.5", "1.0")                      | `0.5`                         |
| `memory`                | Memory to allocate (e.g., "1Gi", "2Gi")                         | `1Gi`                         |
| `timeout`               | Job execution timeout in seconds                                | `1800` (30 minutes)           |
| `registry-server`       | Container registry server (e.g., ghcr.io)                       | None                          |
| `registry-username`     | Container registry username                                     | None                          |
| `registry-password`     | Container registry password                                     | None                          |

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

Environment variables are passed as plain text, while secrets refer to the Azure Key Vault URLs, and will be automatically 
decrypted and added to the environment during runtime.

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
