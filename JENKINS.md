# Jenkins Deployment Setup

The repository root `Jenkinsfile` performs SCM checkout, Docker builds, ECR
pushes, Kubernetes Secret injection, and EKS rollout.

It does not recreate infrastructure on every build. The EKS cluster, worker
nodes, EBS CSI addon, and RDS routing should be created once using the Kubernetes
runbook. The pipeline verifies cluster access and deploys application changes.

## Jenkins Agent

Run the pipeline on an agent labelled `docker-aws` with these tools available:

```bash
aws --version
kubectl version --client
docker --version
eksctl version
```

`eksctl` is only needed when the `CREATE_CLUSTER_IF_MISSING` parameter is
explicitly enabled. The agent must be allowed to use Docker, normally through a
configured Docker socket or a dedicated Docker-capable build agent.

## Jenkins Plugins

Install:

- Pipeline
- Git
- Credentials Binding
- AWS Credentials

## Jenkins Credentials

Create these credentials in Jenkins:

| Jenkins ID | Type | Contents |
| --- | --- | --- |
| `aws-jenkins` | AWS credentials or an equivalent IAM-backed credential | AWS access for ECR, EKS, RDS/EC2 discovery, and `kubectl` authentication |
| `etp-k8s-secrets-env` | Secret file | Lines from the target project's ignored `k8s/base/secrets.env` |

The Secret file must contain keys matching the application code, for example:

```env
DB_PASSWORD=...
JWT_SECRET=...
FAUXNANCE_API_KEY=...
GEMINI_API_KEY=...
SMTP_USER=...
SMTP_PASS=...
```

Do not commit this file or print it in Jenkins logs. The pipeline copies it to
`k8s/base/secrets.env` only for the deployment and deletes it in `post.always`.

## Create the Pipeline Job

1. Open Jenkins at `http://localhost:8080`.
2. Create a **Pipeline** job.
3. Select **Pipeline script from SCM**.
4. Select Git and use the application repository URL.
5. Set the branch to `*/main`.
6. Set the script path to `Jenkinsfile`.
7. Select an agent that has the `docker-aws` label.
8. Run **Build with Parameters**.

Default parameters target the tested deployment:

```text
AWS_REGION=ap-south-1
EKS_CLUSTER_NAME=etp-cluster-2
K8S_OVERLAY=k8s/overlays/four-lb
K8S_NAMESPACE=default
CREATE_CLUSTER_IF_MISSING=false
AUTO_AUTHORIZE_RDS=false
```

## RDS Security Group Behavior

The pipeline does not modify RDS security groups by default. This is deliberate:
security-group changes are infrastructure operations and should normally be
approved separately.

If the EKS node security group has not been allowed to reach RDS, set the
pipeline parameter:

```text
AUTO_AUTHORIZE_RDS=true
```

The pipeline then discovers the RDS instance, EKS nodegroup, and security groups
from AWS and attempts to add TCP `5432`. It does not create a temporary
connectivity pod; application rollout and readiness checks provide the deployment
failure signal. The AWS Jenkins credential must have the required RDS and EC2
permissions for this optional stage.

## Image Flow

For each build, Jenkins:

1. Checks out the application repository from SCM.
2. Computes a unique image tag from the build number and Git commit.
3. Creates missing ECR repositories.
4. Builds auth, order, executor, and frontend images.
5. Pushes them to the current AWS account's ECR registry.
6. Applies the Kustomize overlay.
7. Uses `kubectl set image` to point all four Deployments at the new ECR tag.
8. Waits for all four rollouts to become ready.

The ECR repository names are controlled by the `AUTH_REPO`, `ORDER_REPO`,
`EXECUTOR_REPO`, and `FRONTEND_REPO` environment values in the Jenkinsfile.
Change those values for another team's repositories.

## Important Preconditions

Before the first pipeline run:

```bash
aws eks update-kubeconfig --region ap-south-1 --name etp-cluster-2
kubectl get nodes
kubectl get pods -n kube-system | grep ebs
```

The Kubernetes overlay must contain the target project's `config.env`,
`generated/application.yml`, URL values, image names, and the matching Secret
keys. The pipeline cannot infer application-specific environment contracts from
Docker images.
