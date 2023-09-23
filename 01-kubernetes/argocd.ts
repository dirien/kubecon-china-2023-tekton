import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export interface InitialRepository {
    url?: string;
    branch?: string;
    path?: string;
}

export interface ArgoCDArgs {
    initialRepository?: InitialRepository;
}

export class ArgoCD extends pulumi.ComponentResource {
    initialRepository: InitialRepository;

    constructor(name: string,
                args: ArgoCDArgs,
                opts: pulumi.ComponentResourceOptions = {}) {
        super("pkg:index:ArgoCD", name, {}, opts);
        this.initialRepository = args.initialRepository || {};

        const argocd = new k8s.helm.v3.Release("argocd", {
            chart: "argo-cd",
            version: "5.46.6",
            repositoryOpts: {
                repo: "https://argoproj.github.io/argo-helm",
            },
            createNamespace: true,

            namespace: "argocd",
            values: {
                configs: {
                    secret: {
                        argocdServerAdminPassword: "$2a$10$RjjTokiJSaTQt8jAMOUTK.O0VIZ3.0AEs3/JxtaFKGZir93yFPEOG"
                    },
                    params: {
                        "server\.insecure": true,
                        "server\.basehref": "/argocd",
                        "server\.rootpath": "/argocd"
                    }
                },
                server: {
                    ingress: {
                        enabled: true,
                        paths: [
                            "/argocd(/|$)(.*)"
                        ],
                        ingressClassName: "nginx",
                    }
                }
            }
        }, {
            parent: this,
        });

        if (this.initialRepository) {
            new k8s.apiextensions.CustomResource("argocd-application", {
                apiVersion: "argoproj.io/v1alpha1",
                kind: "Application",
                metadata: {
                    name: "app-of-apps",
                    namespace: argocd.namespace,
                },
                spec: {
                    project: "default",
                    destination: {
                        namespace: "default",
                        name: "in-cluster",
                    },
                    source: {
                        repoURL: this.initialRepository.url,
                        targetRevision: this.initialRepository.branch,
                        path: this.initialRepository.path,
                    },
                    syncPolicy: {
                        automated: {
                            prune: true,
                            selfHeal: true,
                        },
                        syncOptions: [
                            "ServerSideApply=true"
                        ]
                    }
                }
            }, {
                parent: this,
                dependsOn: argocd,
            })
        }
    }
}
