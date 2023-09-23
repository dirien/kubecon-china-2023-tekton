import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

import {Tekton} from "./tekton";
import {Backstage} from "./backstage";
import {ArgoCD} from "./argocd";
import {KubeVela} from "./kubevela";
import {Kyverno} from "./kyverno";

const settings: pulumi.Config = new pulumi.Config("settings");
const isLocal = settings.requireBoolean("isLocal");

let kubeconfig = undefined;


if (!isLocal) {
    const infraStackReference = new pulumi.StackReference("dirien/kubecon-china-tekton-infrastructure/dev");
    kubeconfig = infraStackReference.getOutput("kubeconfig");
}

const k8sProvider = new k8s.Provider("k8s", {
    kubeconfig: kubeconfig,
    enableServerSideApply: true,
});


if (isLocal) {
    // install nginx ingress controller
    const nginx = new k8s.helm.v3.Release("nginx", {
        chart: "ingress-nginx",
        version: "4.7.2",
        repositoryOpts: {
            repo: "https://kubernetes.github.io/ingress-nginx",
        },
        namespace: "ingress-nginx",
        name: "ingress-nginx",
        createNamespace: true,
        values: {
            controller: {
                allowSnippetAnnotations: true
            }
        }
    }, {provider: k8sProvider});
}

const tekton = new Tekton("tekton", {
    providers: {
        kubernetes: k8sProvider,
    }
});

new Kyverno("kyverno", {
    installReporter: true,
    kyvernoTektonPolicies: [
        "require-tekton-namespace-pipelinerun",
    ],
}, {
    dependsOn: [
        tekton,
    ],
    providers: {
        kubernetes: k8sProvider,
    }
})

new ArgoCD("argocd", {
    initialRepository: {
        url: "https://github.com/my-silly-organisation/kubecon-2023-argocd",
        branch: "main",
        path: ".",
    }
}, {
    providers: {
        kubernetes: k8sProvider,
    }
})

new KubeVela("kubevela", {
    providers: {
        kubernetes: k8sProvider,
    }
})

const backstage = new Backstage("backstage", {
    providers: {
        kubernetes: k8sProvider,
    }
});

export const imageName = backstage.imageName;
export const repoDigest = backstage.repoDigest;



