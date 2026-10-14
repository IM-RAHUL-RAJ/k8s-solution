pipeline {
  agent { label 'docker-aws' }

  options {
    timestamps()
    disableConcurrentBuilds()
    skipDefaultCheckout(true)
    timeout(time: 45, unit: 'MINUTES')
  }

  parameters {
    string(name: 'AWS_REGION', defaultValue: 'ap-south-1', description: 'AWS region')
    string(name: 'EKS_CLUSTER_NAME', defaultValue: 'etp-cluster-2', description: 'Existing EKS cluster name')
    string(name: 'AWS_CREDENTIALS_ID', defaultValue: 'aws-jenkins', description: 'Jenkins AWS credentials ID')
    string(name: 'K8S_SECRETS_CREDENTIAL_ID', defaultValue: 'etp-k8s-secrets-env', description: 'Jenkins Secret file containing KEY=VALUE lines for k8s/base/secrets.env')
    string(name: 'K8S_OVERLAY', defaultValue: 'k8s/overlays/four-lb', description: 'Kustomize overlay')
    string(name: 'K8S_NAMESPACE', defaultValue: 'default', description: 'Namespace where the current manifests create workloads')
    booleanParam(name: 'CREATE_CLUSTER_IF_MISSING', defaultValue: false, description: 'Create the cluster from k8s/cluster.example.yaml if it does not exist')
    booleanParam(name: 'AUTO_AUTHORIZE_RDS', defaultValue: false, description: 'Add the EKS node security group to the RDS security group')
    string(name: 'IMAGE_TAG', defaultValue: '', description: 'Optional image tag. Empty uses BUILD_NUMBER-GIT_COMMIT.')
  }

  environment {
    AUTH_REPO = 'etp-auth-service'
    ORDER_REPO = 'etp-order-service'
    EXECUTOR_REPO = 'etp-executor-service'
    FRONTEND_REPO = 'etp-frontend'
    AUTH_LOCAL_IMAGE = 'auth-service'
    ORDER_LOCAL_IMAGE = 'order-service'
    EXECUTOR_LOCAL_IMAGE = 'executor-service'
    FRONTEND_LOCAL_IMAGE = 'frontend'
    DB_PORT = '5432'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          def shortCommit = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
          env.RELEASE_TAG = params.IMAGE_TAG?.trim() ? params.IMAGE_TAG.trim() : "${env.BUILD_NUMBER}-${shortCommit}"
        }
      }
    }

    stage('Validate tools and AWS') {
      steps {
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: params.AWS_CREDENTIALS_ID]]) {
          sh '''#!/usr/bin/env bash
            set -euo pipefail
            command -v aws >/dev/null
            command -v docker >/dev/null
            command -v kubectl >/dev/null
            test -f k8s/cluster.example.yaml
            test -f "${K8S_OVERLAY}/kustomization.yaml"
            test -f k8s/base/kustomization.yaml
            AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
            echo "AWS account: ${AWS_ACCOUNT_ID}"
          '''
        }
      }
    }

    stage('Ensure EKS access') {
      steps {
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: params.AWS_CREDENTIALS_ID]]) {
          sh '''#!/usr/bin/env bash
            set -euo pipefail
            if aws eks describe-cluster --region "$AWS_REGION" --name "$EKS_CLUSTER_NAME" >/dev/null 2>&1; then
              echo "EKS cluster exists: $EKS_CLUSTER_NAME"
            elif [ "$CREATE_CLUSTER_IF_MISSING" = "true" ]; then
              eksctl create cluster -f k8s/cluster.example.yaml
            else
              echo "EKS cluster $EKS_CLUSTER_NAME does not exist. Enable CREATE_CLUSTER_IF_MISSING or create it once from cluster.example.yaml." >&2
              exit 1
            fi
            aws eks update-kubeconfig --region "$AWS_REGION" --name "$EKS_CLUSTER_NAME"
            kubectl get nodes -o wide
            kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver --no-headers >/dev/null || {
              echo 'aws-ebs-csi-driver is missing. Install it once on the cluster before deploying Kafka.' >&2
              exit 1
            }
          '''
        }
      }
    }

    stage('Authorize RDS access') {
      when {
        expression { params.AUTO_AUTHORIZE_RDS }
      }
      steps {
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: params.AWS_CREDENTIALS_ID]]) {
          sh '''#!/usr/bin/env bash
            set -euo pipefail
            DB_HOST=$(awk -F= '$1 == "DB_HOST" {print $2}' k8s/base/config.env)
            NODEGROUP=$(aws eks list-nodegroups --region "$AWS_REGION" --cluster-name "$EKS_CLUSTER_NAME" --query 'nodegroups[0]' --output text)
            test -n "$NODEGROUP" -a "$NODEGROUP" != None
            RDS_INSTANCE_ID=$(aws rds describe-db-instances --region "$AWS_REGION" --query "DBInstances[?Endpoint.Address=='$DB_HOST'].DBInstanceIdentifier | [0]" --output text)
            test -n "$RDS_INSTANCE_ID" -a "$RDS_INSTANCE_ID" != None
            NODE_INSTANCE_ID=$(aws ec2 describe-instances --region "$AWS_REGION" \
              --filters "Name=tag:eks:nodegroup-name,Values=$NODEGROUP" "Name=instance-state-name,Values=running" \
              --query 'Reservations[].Instances[0].InstanceId | [0]' --output text)
            test -n "$NODE_INSTANCE_ID" -a "$NODE_INSTANCE_ID" != None
            RDS_SECURITY_GROUP_ID=$(aws rds describe-db-instances --region "$AWS_REGION" --db-instance-identifier "$RDS_INSTANCE_ID" --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
            EKS_NODE_SECURITY_GROUP_ID=$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$NODE_INSTANCE_ID" --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)
            aws ec2 authorize-security-group-ingress --group-id "$RDS_SECURITY_GROUP_ID" --protocol tcp --port 5432 --source-group "$EKS_NODE_SECURITY_GROUP_ID" || echo 'RDS rule already exists or needs review.'
          '''
        }
      }
    }

    stage('Build and push ECR images') {
      steps {
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: params.AWS_CREDENTIALS_ID]]) {
          script {
            env.AWS_ACCOUNT_ID = sh(script: 'aws sts get-caller-identity --query Account --output text', returnStdout: true).trim()
            env.REGISTRY = "${env.AWS_ACCOUNT_ID}.dkr.ecr.${params.AWS_REGION}.amazonaws.com"
          }
          sh '''#!/usr/bin/env bash
            set -euo pipefail
            aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"
            for repo in "$AUTH_REPO" "$ORDER_REPO" "$EXECUTOR_REPO" "$FRONTEND_REPO"; do
              aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$repo" >/dev/null 2>&1 || \
              aws ecr create-repository --region "$AWS_REGION" --repository-name "$repo" --image-scanning-configuration scanOnPush=true --encryption-configuration encryptionType=AES256 >/dev/null
            done

            AUTH_URL=$(awk -F= '$1 == "AUTH_SERVICE_URL" {print $2}' "${K8S_OVERLAY}/urls.env")
            ORDER_URL=$(awk -F= '$1 == "ORDER_SERVICE_URL" {print $2}' "${K8S_OVERLAY}/urls.env")
            FRONTEND_URL=$(awk -F= '$1 == "FRONTEND_URL" {print $2}' "${K8S_OVERLAY}/urls.env")
            BUILD_ENV="AUTH_SERVICE_URL=$AUTH_URL AUTH_SERVICE_PORT=3000 ORDER_SERVICE_URL=$ORDER_URL ORDER_SERVICE_PORT=8081 FRONTEND_URL=$FRONTEND_URL FRONTEND_PORT=80"

            docker build -t "$AUTH_LOCAL_IMAGE:$RELEASE_TAG" ./services/auth_service
            docker build -t "$ORDER_LOCAL_IMAGE:$RELEASE_TAG" ./services/trade-api
            docker build -t "$EXECUTOR_LOCAL_IMAGE:$RELEASE_TAG" ./services/executor
            docker build --build-arg "BUILD_ENV=$BUILD_ENV" -t "$FRONTEND_LOCAL_IMAGE:$RELEASE_TAG" ./frontend

            declare -A IMAGE_MAP=(
              ["$AUTH_REPO"]="$AUTH_LOCAL_IMAGE"
              ["$ORDER_REPO"]="$ORDER_LOCAL_IMAGE"
              ["$EXECUTOR_REPO"]="$EXECUTOR_LOCAL_IMAGE"
              ["$FRONTEND_REPO"]="$FRONTEND_LOCAL_IMAGE"
            )
            for repo in "${!IMAGE_MAP[@]}"; do
              docker tag "${IMAGE_MAP[$repo]}:$RELEASE_TAG" "$REGISTRY/$repo:$RELEASE_TAG"
              docker push "$REGISTRY/$repo:$RELEASE_TAG"
            done
            echo "Pushed images to $REGISTRY with tag $RELEASE_TAG"
          '''
        }
      }
    }

    stage('Prepare Kubernetes images and secrets') {
      steps {
        withCredentials([file(credentialsId: params.K8S_SECRETS_CREDENTIAL_ID, variable: 'K8S_SECRET_FILE')]) {
          sh '''#!/usr/bin/env bash
            set -euo pipefail
            cp "$K8S_SECRET_FILE" k8s/base/secrets.env
            kubectl kustomize "$K8S_OVERLAY" >/tmp/rendered-k8s.yaml
          '''
        }
      }
    }

    stage('Deploy to EKS') {
      steps {
        sh '''#!/usr/bin/env bash
          set -euo pipefail
          kubectl apply --dry-run=server -k "$K8S_OVERLAY"
          kubectl apply -k "$K8S_OVERLAY"
          kubectl -n "$K8S_NAMESPACE" set image deployment/auth-service auth-service="$REGISTRY/$AUTH_REPO:$RELEASE_TAG"
          kubectl -n "$K8S_NAMESPACE" set image deployment/order-service order-service="$REGISTRY/$ORDER_REPO:$RELEASE_TAG"
          kubectl -n "$K8S_NAMESPACE" set image deployment/executor-service executor-service="$REGISTRY/$EXECUTOR_REPO:$RELEASE_TAG"
          kubectl -n "$K8S_NAMESPACE" set image deployment/frontend frontend="$REGISTRY/$FRONTEND_REPO:$RELEASE_TAG"
          kubectl -n "$K8S_NAMESPACE" rollout status deployment/auth-service --timeout=180s
          kubectl -n "$K8S_NAMESPACE" rollout status deployment/order-service --timeout=180s
          kubectl -n "$K8S_NAMESPACE" rollout status deployment/executor-service --timeout=180s
          kubectl -n "$K8S_NAMESPACE" rollout status deployment/frontend --timeout=180s
          kubectl -n "$K8S_NAMESPACE" get pods -o wide
          kubectl -n "$K8S_NAMESPACE" get svc
        '''
      }
    }
  }

  post {
    always {
      sh 'rm -f k8s/base/secrets.env'
      sh 'docker logout "${REGISTRY:-}" || true'
    }
    success {
      echo 'Images pushed and Kubernetes rollout completed.'
    }
  }
}
