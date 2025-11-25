# Example Usage

This directory contains example workflows demonstrating how to use this action.

## Basic Example

```yaml
name: Run Azure Container Job

on:
  workflow_dispatch:

jobs:
  run-job:
    runs-on: ubuntu-latest
    steps:
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
          image: ghcr.io/myorg/myimage:latest
          registry-server: ghcr.io
          registry-username: ${{ github.actor }}
          registry-password: ${{ secrets.GITHUB_TOKEN }}
```

## Complete Example

```yaml
name: Run Azure Container Job with Full Configuration

on:
  workflow_dispatch:
    inputs:
      image_tag:
        description: 'Container image tag'
        required: true
        default: 'latest'

jobs:
  run-job:
    runs-on: ubuntu-latest
    steps:
      - name: Azure Login with OIDC
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Run Container Job
        id: job
        uses: enosix/github-action-container-job@v1
        with:
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          resource-group: my-resource-group
          environment-name: my-container-env
          image: ghcr.io/myorg/myimage:${{ github.event.inputs.image_tag }}
          command: python script.py --mode production
          user-managed-identity: /subscriptions/.../resourcegroups/.../providers/Microsoft.ManagedIdentity/userAssignedIdentities/my-identity
          environment-variables: |
            {
              "LOG_LEVEL": "info",
              "API_URL": "https://api.production.example.com"
            }
          secrets: |
            {
              "API_KEY": "${{ secrets.API_KEY }}",
              "DATABASE_PASSWORD": "${{ secrets.DB_PASSWORD }}"
            }
          cpu: "1.0"
          memory: "2Gi"
          timeout: "3600"
          registry-server: ghcr.io
          registry-username: ${{ github.actor }}
          registry-password: ${{ secrets.GITHUB_TOKEN }}

      - name: Display Results
        if: always()
        run: |
          echo "Job Name: ${{ steps.job.outputs.job-name }}"
          echo "Execution Name: ${{ steps.job.outputs.execution-name }}"
          echo "Exit Code: ${{ steps.job.outputs.exit-code }}"
          echo "Status: ${{ steps.job.outputs.logs }}"
```
