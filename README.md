# From Cat to Lion: A Practical Guide to Building Secure, Large-Scale CI/CD Platforms with Tekton and Friends

## Introduction

This is the code repository for my KubeCon China talk on the 26th to 28th of September 2023 in Shanghai. I separated the
code into several independent Pulumi stacks, in case I am not able to provision the infrastructure due to internet
connectivity issues. The stacks are:

- `00-infrastructure`: Provision the infrastructure for the demo on AWS, this will expose the `kubeconfig` file as an
  output.
- `01-kubernetes`: Provision the services (Tekton, KubeVekla, ArgoCD, etc.) on the Kubernetes cluster using
  the `kubeconfig` file from the previous stack.

### Modern Infrastructure As Code with Pulumi

Pulumi is an open-source infrastructure-as-code tool for creating, deploying and managing cloud
infrastructure. Pulumi works with traditional infrastructures like VMs, networks, and databases and modern
architectures, including containers, Kubernetes clusters, and serverless functions. Pulumi supports dozens of public,
private, and hybrid cloud service providers.

Pulumi is a multi-language infrastructure as Code tool using imperative languages to create a declarative
infrastructure description.

You have a wide range of programming languages available, and you can use the one you and your team are the most
comfortable with. Currently, (6/2023) Pulumi supports the following languages:

* Node.js (JavaScript / TypeScript)

* Python

* Go

* Java

* .NET (C#, VB, F#)

* YAML

The workshop examples are written in `typescript` but feel free to use the language you are most comfortable
with.

## Pre-requisites

To follow along with the tutorial, you will need the following tools installed on your machine:

- [Pulumi](https://www.pulumi.com/docs/get-started/install/)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
- [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
- [helm](https://helm.sh/docs/intro/install/)
- [k9s](https://k9scli.io/topics/install/)

## Getting Started

### Step 1 - Clone the repo

Go to GitHub and fork/clone the [Production Ready Kubernetes Workshop](pulumi-production-ready-kubernetes)
repo and then change into the directory.

If you use SSH to clone:

```bash
git clone git@github.com:dirien/kubecon-china-2023-tekton.git
cd kubecon-china-2023-tekton
```

To clone with HTTP:

```bash
git clone https://github.com/dirien/kubecon-china-2023-tekton.git
cd kubecon-china-2023-tekton
```

### Step 2 - Set up Pulumi

Change into the `00-infrastructure` directory.

```bash
cd 00-infrastructure
npm install
```

You may need to log in to your AWS account. Follow the instructions on the screen to login. After you logged in, you
can run the following command to create a new stack.

> Please name your stack `dev` for this workshop

```bash
pulumi up
```

If the preview looks good, select `yes` to deploy the cluster, and the deployment will start. This can take a few
minutes.

After the infrastructure is deployed, you can change into the `01-kubernetes` directory.

```bash
cd 01-kubernetes
npm install
```

Most important part of a Pulumi program is the `Pulumi.yaml`. Here you can define and modify various settings. From
the runtime of the programming language you are using to changing the default config values.

### Step 3 - Run Pulumi Up

> **Note:** If you run Pulumi for the first time, you will be asked to log in. Follow the instructions on the screen to
> login. You may need to create an account first, don't worry it is free.
> Alternatively you can use also the `pulumi login --local` command to login locally.

```bash
pulumi up
```

Pulumi will ask you now to create a new stack. You can name the stack whatever you want. If you run Pulumi with the
local login, please make sure to use for every stack a different name.

> Please name your stack `dev` for this workshop

```bash
Please choose a stack, or create a new one:  [Use arrows to move, type to filter]
> <create a new stack>
Please choose a stack, or create a new one: <create a new stack>
Please enter your desired stack name: dev   
```

If the preview looks good, select `yes` to deploy the cluster

If the deployment is successful, you should see the following output. The duration of the deployment can take a few
minutes.

```bash
...
Resources:
    + XY created

Duration: 999m6s
```

### Step 4 - Verify the deployment

After the deployment is successful, you can verify the deployment by running the following commands:

```bash
kubectl get pods -A
```

You should see the following output:

```bash
k get pods -A
NAMESPACE          NAME                                                              READY   STATUS      RESTARTS      AGE
argocd             argocd-0fdd13a2-application-controller-0                          1/1     Running     0             6h45m
argocd             argocd-0fdd13a2-applicationset-controller-85996647fc-clp24        1/1     Running     0             6h45m
argocd             argocd-0fdd13a2-dex-server-5ffcc98cf7-8dns9                       1/1     Running     0             6h45m
argocd             argocd-0fdd13a2-notifications-controller-6df8859b8-fswbv          1/1     Running     0             6h45m
argocd             argocd-0fdd13a2-redis-55ccfddf5-l7s82                             1/1     Running     0             6h45m
argocd             argocd-0fdd13a2-repo-server-5544cdc64c-nsmmc                      1/1     Running     0             6h45m
argocd             argocd-0fdd13a2-server-5b4db458cb-ghsxk                           1/1     Running     0             6h45m
backstage          backstage-7798fb76b9-gvdhq                                        1/1     Running     0             6h52m
compliance         kyverno-admission-controller-868dd7bbb6-n4gtm                     1/1     Running     0             5h45m
compliance         kyverno-background-controller-7db6c6978f-qsw9w                    1/1     Running     0             5h45m
compliance         kyverno-cleanup-admission-reports-28256790-6z4pz                  0/1     Completed   0             65s
compliance         kyverno-cleanup-cluster-admission-reports-28256790-22cnl          0/1     Completed   0             65s
compliance         kyverno-cleanup-controller-b6f76c5d9-48m4d                        1/1     Running     0             5h45m
compliance         kyverno-policy-report-24eb08f5-kyverno-plugin-6b664cbc95-9nnpc    1/1     Running     0             5h44m
compliance         kyverno-policy-report-24eb08f5-policy-reporter-64fc84fbcc-2bpsl   1/1     Running     0             5h44m
compliance         kyverno-policy-report-24eb08f5-ui-66b6ddf8b9-dmzbf                1/1     Running     0             5h44m
compliance         kyverno-reports-controller-78644656c9-ndqld                       1/1     Running     0             5h45m
ingress-nginx      ingress-nginx-controller-5dcc7dbd55-gbzpv                         1/1     Running     0             7h11m
kube-system        coredns-5d78c9869d-lrrmv                                          1/1     Running     1 (36h ago)   14d
kube-system        coredns-5d78c9869d-p9b8z                                          1/1     Running     1 (36h ago)   14d
kube-system        etcd-docker-desktop                                               1/1     Running     1 (36h ago)   14d
kube-system        kube-apiserver-docker-desktop                                     1/1     Running     1 (36h ago)   14d
kube-system        kube-controller-manager-docker-desktop                            1/1     Running     1 (36h ago)   14d
kube-system        kube-proxy-wdfk5                                                  1/1     Running     1 (36h ago)   14d
kube-system        kube-scheduler-docker-desktop                                     1/1     Running     1 (36h ago)   14d
kube-system        storage-provisioner                                               1/1     Running     3 (36h ago)   14d
kube-system        vpnkit-controller                                                 1/1     Running     1 (36h ago)   14d
tekton-operator    tekton-operator-6fd8cfc9dc-bt9xx                                  2/2     Running     0             7h3m
tekton-operator    tekton-operator-webhook-75b6b74c94-sjll9                          1/1     Running     0             7h3m
tekton-pipelines   tekton-chains-controller-6b4fbddd6c-hbsnf                         1/1     Running     0             6h59m
tekton-pipelines   tekton-dashboard-77dffdbcfb-rc2vr                                 1/1     Running     0             6h59m
tekton-pipelines   tekton-events-controller-54999fc95-b4r5t                          1/1     Running     0             7h
tekton-pipelines   tekton-operator-proxy-webhook-567bf69c68-vzn28                    1/1     Running     0             7h
tekton-pipelines   tekton-pipelines-controller-767fb74969-tqmmt                      1/1     Running     0             7h
tekton-pipelines   tekton-pipelines-remote-resolvers-749985c4cf-z297w                1/1     Running     0             7h
tekton-pipelines   tekton-pipelines-webhook-8465b4dc79-ftndr                         1/1     Running     0             7h
tekton-pipelines   tekton-triggers-controller-6df59f985f-k82m8                       1/1     Running     0             6h59m
tekton-pipelines   tekton-triggers-core-interceptors-5b9ccd74f-62jf2                 1/1     Running     0             6h59m
tekton-pipelines   tekton-triggers-webhook-7fdb45654b-5p8hr                          1/1     Running     0             6h59m
vela-system        kubevela-e2d2525d-cluster-gateway-7c8695df69-txtrb                1/1     Running     0             6h41m
vela-system        kubevela-e2d2525d-vela-core-7c6cbcfbfd-2hfvw                      1/1     Running     0             6h41m
vela-system        velaux-server-655598d6c-mnbll                                     1/1     Running     0             6h41m
```

Congratulations! You have successfully deployed the tutorial environment. Please leave the cluster up and running for
the workshop.
