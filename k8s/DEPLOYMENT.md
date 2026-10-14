# EKS Deployment Guide

This guide documents the deployment used for this project and explains which
parts of `k8s/` are reusable for another project.

## Architecture

The deployment contains:

- An EKS control plane and a managed EC2 node group.
- Kafka running as a single-node KRaft StatefulSet with an encrypted EBS gp3 volume.
- Auth, order, executor, and frontend application workloads.
- An existing PostgreSQL RDS instance. The optional in-cluster PostgreSQL is not used.
- Four Kubernetes `LoadBalancer` Services for the first test deployment.

The four-load-balancer layout is useful for initial connectivity testing. For a
real browser deployment, prefer the ingress overlay: one ALB gives the frontend
and APIs one origin and avoids cross-site refresh-cookie problems.

## Prerequisites

Install or verify these tools:

```bash
aws --version
kubectl version --client
helm version
eksctl version
docker --version
```

Install `eksctl` on Linux if it is missing:

```bash
ARCH=$(uname -m)
case "$ARCH" in
  x86_64) EKSCTL_ARCH=amd64 ;;
  aarch64) EKSCTL_ARCH=arm64 ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

curl --fail --location \
  "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_Linux_${EKSCTL_ARCH}.tar.gz" \
  | tar xz -C /tmp
sudo install -m 0755 /tmp/eksctl /usr/local/bin/eksctl
eksctl version
```

Authenticate AWS and select a region:

```bash
aws configure
aws sts get-caller-identity
export AWS_REGION=ap-south-1
aws configure set region "$AWS_REGION"
```

## Create EKS

Edit [`cluster.example.yaml`](cluster.example.yaml) for the project name,
region, node type, and node count. The example uses `t3.large`; two `t3.medium`
nodes were used for the first test, but the smaller nodes are tight when Kafka
and all application services run together.

Create a cluster from the example:

```bash
eksctl create cluster -f k8s/cluster.example.yaml
```

Or create the tested two-node setup directly:

```bash
eksctl create cluster \
  --name etp-cluster-2 \
  --region "$AWS_REGION" \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 3 \
  --managed \
  --with-oidc
```

If CloudFormation reports that `eksctl-<name>-cluster` already exists, do not
run the create command again. Inspect the existing operation:

```bash
aws cloudformation describe-stacks \
  --region "$AWS_REGION" \
  --stack-name eksctl-<name>-cluster \
  --query 'Stacks[0].{Status:StackStatus,Reason:StackStatusReason}' \
  --output table

aws eks describe-cluster \
  --region "$AWS_REGION" \
  --name <name> \
  --query 'cluster.status' \
  --output text
```

If the control plane is `ACTIVE` but no nodegroup exists, add workers without
recreating the cluster:

```bash
eksctl create nodegroup \
  --cluster <name> \
  --region "$AWS_REGION" \
  --name workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 3 \
  --managed \
  --node-private-networking
```

Configure `kubectl` and verify workers before applying manifests:

```bash
aws eks update-kubeconfig --region "$AWS_REGION" --name <name>
kubectl config current-context
kubectl get nodes -o wide
```

## Storage Addon

Kafka uses the `gp3` StorageClass, which requires the AWS EBS CSI driver. The
cluster must have OIDC or EKS Pod Identity configured so the driver can call
EC2 APIs.

Preferred approach for a new cluster:

```bash
eksctl create addon \
  --cluster <name> \
  --region "$AWS_REGION" \
  --name aws-ebs-csi-driver \
  --force
```

Verify it before applying Kafka:

```bash
kubectl get pods -n kube-system | grep ebs
kubectl get storageclass gp3
```

In the first test cluster, OIDC permissions were unavailable and the managed
driver temporarily used the node role. The required recovery was:

```bash
aws iam attach-role-policy \
  --role-name <EKS_NODE_ROLE> \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy
```

Use a dedicated addon role or EKS Pod Identity for production instead of adding
storage permissions to worker nodes.

## RDS Connectivity

The EKS nodes need network access to the RDS endpoint. VPC peering is only
needed when EKS and RDS are in different VPCs without another route between
them. For the same VPC, configure the RDS security group to allow TCP `5432`
from the EKS node security group:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id <RDS_SECURITY_GROUP_ID> \
  --protocol tcp \
  --port 5432 \
  --source-group <EKS_NODE_SECURITY_GROUP_ID>
```

Check the path from inside Kubernetes:

```bash
kubectl run rds-test --rm -it --restart=Never \
  --image=postgres:16 -- bash
```

Inside the temporary pod:

```bash
PGPASSWORD='<password>' pg_isready \
  -h <RDS_ENDPOINT> -p 5432 -U <DB_USER> -d <DB_NAME>
```

For this deployment, Java uses encrypted PostgreSQL connections with
`sslmode=require`. Certificate verification is intentionally disabled in the
current test setup; use the RDS CA bundle and `verify-full` for production.

## ECR Images

Create one private ECR repository per application image:

```bash
for repo in etp-auth-service etp-order-service etp-executor-service etp-frontend; do
  aws ecr create-repository \
    --region "$AWS_REGION" \
    --repository-name "$repo" \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256 || true
done
```

Authenticate and push images:

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

docker build -t etp-auth-service ./services/auth_service
docker build -t etp-order-service ./services/trade-api
docker build -t etp-executor-service ./services/executor
docker build -t etp-frontend ./frontend

for image in etp-auth-service etp-order-service etp-executor-service etp-frontend; do
  docker tag "$image:latest" "$REGISTRY/$image:latest"
  docker push "$REGISTRY/$image:latest"
done
```

Update the `images` block in [`base/kustomization.yaml`](base/kustomization.yaml)
with the new registry and immutable image tags or digests. Do not leave another
project's AWS account ID or image tag in that file.

## Project Configuration

Copy the deployment kit into the project root and configure these files:

1. [`base/config.env`](base/config.env): non-secret settings such as RDS host,
   database name, schemas, ports, Kafka topics, service URLs, and feature flags.
2. [`base/secrets.env.example`](base/secrets.env.example): template only. Copy
   it to `base/secrets.env` locally and fill in passwords, JWT secrets, and API
   keys. The real file is ignored by Git.
3. [`base/generated/application.yml`](base/generated/application.yml): the
   shared application configuration expected by the service images. Replace it
   with the target project's compatible shared configuration.
4. `overlays/four-lb/urls.env`: public frontend/API hostnames after the
   LoadBalancers receive DNS names. Values must match how the application joins
   hostnames and ports.
5. [`base/kustomization.yaml`](base/kustomization.yaml): image repositories and
   tags, plus the resource list.

Render before applying:

```bash
kubectl kustomize k8s/overlays/four-lb >/tmp/rendered.yaml
kubectl apply --dry-run=server -k k8s/overlays/four-lb
```

Apply the first four-LB deployment:

```bash
kubectl apply -k k8s/overlays/four-lb
kubectl get pods -w
kubectl get svc
```

Use the one-ALB ingress later:

```bash
kubectl apply -k k8s/overlays/ingress
kubectl get ingress
```

## File Reference

### Cluster and Base

- `cluster.example.yaml`: `eksctl` cluster configuration, managed nodegroup,
  OIDC setting, and AWS addons.
- `base/kustomization.yaml`: base resource list, generated ConfigMaps/Secret,
  and ECR image replacement rules.
- `base/namespace.yaml`: creates the `etp` namespace. Confirm the workloads
  target this namespace before production use.
- `base/config.env`: non-secret application configuration.
- `base/secrets.env.example`: safe secret template; never commit the populated
  `secrets.env`.
- `base/generated/application.yml`: shared Spring/Node configuration mounted at
  `/config`.
- `base/storageclass.yaml`: encrypted EBS gp3 storage for StatefulSets.

### Application Workloads

- `base/auth-service.yaml`: auth Deployment and Service on port `3000`.
- `base/order-service.yaml`: Spring trade/order Deployment and Service on port
  `8081`.
- `base/executor-service.yaml`: executor worker Deployment and Service on port
  `8082`.
- `base/frontend.yaml`: nginx frontend Deployment and Service on port `80`.
- `base/kafka.yaml`: single-node Kafka KRaft Service, StatefulSet, probes, and
  persistent volume claim.
- `base/kafka-topics-job.yaml`: one-shot Kafka topic creation Job. It can be
  rerun only after deleting the completed Job.

### Overlays

- `overlays/four-lb/kustomization.yaml`: changes frontend, auth, order, and
  executor Services to `LoadBalancer`.
- `overlays/four-lb/urls.env`: public hostnames consumed by the applications.
- `overlays/ingress/kustomization.yaml`: combines the base with one ALB Ingress.
- `overlays/ingress/ingress.yaml`: routes `/auth`, `/api/v1`, health, and frontend
  traffic through one ALB. Add ACM HTTPS annotations before production use.
- `overlays/ingress/urls.env`: browser-facing URLs for the one-ALB deployment.

### Optional and Support Files

- `optional/postgres/postgres.yaml`: optional in-cluster PostgreSQL StatefulSet;
  do not include it when using RDS.
- `optional/postgres/kustomization.yaml`: resources for the optional PostgreSQL
  overlay.
- `optional/postgres/.gitignore`: ignores generated database seed artifacts.
- `.gitignore` files: keep generated secrets and local files out of Git.
- `kustomize-0.6.0-py3-none-any.whl`: offline packaging artifact; normal EKS
  deployments use the `kubectl`-bundled Kustomize instead.

## Troubleshooting

```bash
kubectl get pods -A
kubectl describe pod <pod>
kubectl logs deployment/auth-service --tail=100
kubectl logs deployment/order-service --tail=100
kubectl get pvc
kubectl get events --sort-by=.lastTimestamp
```

Common symptoms:

- `remaining connection slots are reserved`: stop duplicate local Compose
  workloads and reduce connection pools or resize the small RDS instance.
- Kafka `Pending`: install the EBS CSI driver and check `kubectl get pvc`.
- Browser calls `localhost`: rebuild the frontend with the target URLs; browser
  `localhost` means the user's machine, not the EKS cluster.
- HTTP `400` with UUID parsing: verify client-generated idempotency/request IDs
  are standard UUIDs.

## Cleanup

Delete application resources:

```bash
kubectl delete -k k8s/overlays/four-lb
```

Delete the complete EKS cluster only when its resources are no longer needed:

```bash
eksctl delete cluster --region "$AWS_REGION" --name <name>
```
