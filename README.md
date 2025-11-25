# GitHub Action: Azure Container App Job

A GitHub Action to create, run, and manage Azure Container App Jobs. This action handles the complete lifecycle of a container job including creation, execution, log retrieval, and cleanup.

## Features

- ✅ Create manual Azure Container App Jobs
- ✅ Run jobs and poll for completion/error
- ✅ Retrieve job execution status and information
- ✅ Automatic cleanup (job disposal) regardless of completion status
- ✅ Error handling with proper exit codes
- ✅ Support for custom private images (e.g., from ghcr.io)
- ✅ Customizable container commands
- ✅ User-managed identity support
- ✅ Environment variables and secrets
- ✅ Private container registry authentication

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

| Input | Description |
|-------|-------------|
| `subscription-id` | Azure subscription ID |
| `resource-group` | Azure resource group name |
| `environment-name` | Azure Container App Environment name |
| `image` | Container image to use (e.g., `ghcr.io/owner/image:tag`) |

### Optional Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `job-name` | Name for the container app job (auto-generated if not provided) | `gh-job-{timestamp}-{random}` |
| `command` | Space-delimited command to run in the container | Container default |
| `user-managed-identity` | Resource ID of user-managed identity to assign to the job | None |
| `environment-variables` | JSON object of environment variables | `{}` |
| `secrets` | JSON object of secrets (will be stored securely in Azure) | `{}` |
| `cpu` | CPU cores to allocate (e.g., "0.5", "1.0") | `0.5` |
| `memory` | Memory to allocate (e.g., "1Gi", "2Gi") | `1Gi` |
| `timeout` | Job execution timeout in seconds | `1800` (30 minutes) |
| `registry-server` | Container registry server (e.g., ghcr.io) | None |
| `registry-username` | Container registry username | None |
| `registry-password` | Container registry password | None |

## Outputs

| Output | Description |
|--------|-------------|
| `job-name` | Name of the created job |
| `execution-name` | Name of the job execution |
| `exit-code` | Exit code of the job execution |
| `logs` | Status information from the job execution |

## Authentication

This action uses the [DefaultAzureCredential](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential) from the Azure SDK, which supports multiple authentication methods:

### Option 1: Service Principal (Recommended for CI/CD)

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

### Option 2: OIDC (OpenID Connect)

```yaml
permissions:
  id-token: write
  contents: read

- name: Azure Login
  uses: azure/login@v1
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

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

### Azure Container Registry (ACR)

```yaml
- name: Run Container Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    image: myregistry.azurecr.io/myimage:latest
    registry-server: myregistry.azurecr.io
    registry-username: ${{ secrets.ACR_USERNAME }}
    registry-password: ${{ secrets.ACR_PASSWORD }}
```

## Environment Variables and Secrets

Environment variables are passed as plain text, while secrets are stored securely in Azure and referenced by the container:

```yaml
- name: Run Container Job
  uses: enosix/github-action-container-job@v1
  with:
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    resource-group: my-resource-group
    environment-name: my-container-env
    image: myimage:latest
    environment-variables: |
      {
        "LOG_LEVEL": "debug",
        "API_URL": "https://api.example.com"
      }
    secrets: |
      {
        "API_KEY": "${{ secrets.API_KEY }}",
        "DATABASE_PASSWORD": "${{ secrets.DB_PASSWORD }}"
      }
```

## Error Handling

The action will:
1. Create the Azure Container App Job
2. Start the job execution
3. Poll for completion (up to the specified timeout)
4. Retrieve execution status
5. **Always** clean up the job (even on failure)
6. Exit with an error if the job fails or times out

The action respects the container's exit code - if the container exits with a non-zero code, the action will also fail.

## Requirements

- An Azure subscription
- An existing Azure Container Apps Environment
- Appropriate permissions to create and manage Container App Jobs
- Azure authentication configured (see Authentication section)

## Development

### Building

```bash
npm install
npm run build
```

### Testing

```bash
npm test
```

## License

MIT

## Similar Projects

This action is based on the pattern from [github-action-generate-semver](https://github.com/enosix/github-action-generate-semver).

