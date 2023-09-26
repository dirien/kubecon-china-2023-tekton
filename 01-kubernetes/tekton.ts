import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export class Tekton extends pulumi.ComponentResource {
    constructor(name: string,
                opts: pulumi.ComponentResourceOptions = {}) {
        super("pkg:index:Tekton", name, {}, opts);
        let config = new pulumi.Config();
        const tektonOperator = new k8s.yaml.ConfigFile("tekton-operator", {
            file: "./tekton/release.yaml",
            skipAwait: true,
        }, {
            parent: this,
        });

        const tektonAllComponents = new k8s.apiextensions.CustomResourcePatch("tekton-pipeline-patch", {
            kind: "TektonConfig",
            apiVersion: "operator.tekton.dev/v1alpha1",
            metadata: {
                name: "config"
            },
            spec: {
                profile: "all",
                targetNamespace: "tekton-pipelines",
                pruner: {
                    resources: [
                        "pipelinerun",
                        "taskrun",
                    ],
                    keep: 100,
                    schedule: "0 8 * * *",
                },
                pipeline: {
                    "enable-tekton-oci-bundles": true,
                    "enable-api-fields": "alpha",
                }
            }
        }, {
            parent: this,
            dependsOn: [
                tektonOperator,
            ],
        });

        const buildNamespace = new k8s.core.v1.Namespace("kubecon-china-build", {
            metadata: {
                name: "kubecon-china-build",
            }
        }, {
            parent: this,
            dependsOn: [
                tektonOperator,
                tektonAllComponents,
            ],
        });

        new k8s.core.v1.Secret("basic-auth-secret", {
            metadata: {
                name: "basic-auth",
                namespace: buildNamespace.metadata.name,
            },
            stringData: {
                ".gitconfig": `[credential "https://github.com"]
    helper = store
`,
                ".git-credentials": pulumi.interpolate`https://${config.requireSecret("git-credentials")}@github.com
`,
            }
        }, {
            parent: this,
            dependsOn: [
                tektonOperator,
                tektonAllComponents,
                buildNamespace,
            ],
        });

        const serviceAccount = new k8s.core.v1.ServiceAccount("build-sa", {
            metadata: {
                name: "sa-for-kubevela",
                namespace: buildNamespace.metadata.name,
            }
        }, {
            parent: this,
            dependsOn: [
                tektonOperator,
                tektonAllComponents,
                buildNamespace,
            ],
        });

        new k8s.rbac.v1.ClusterRoleBinding("build-sa-binding", {
            metadata: {
                name: "sa-for-kubevela-binding",
            },
            roleRef: {
                apiGroup: "rbac.authorization.k8s.io",
                kind: "ClusterRole",
                name: "cluster-admin",
            },
            subjects: [
                {
                    kind: "ServiceAccount",
                    name: serviceAccount.metadata.name,
                    namespace: serviceAccount.metadata.namespace,
                }
            ]
        }, {
            parent: this,
            dependsOn: [
                tektonOperator,
                tektonAllComponents,
                buildNamespace,
                serviceAccount,
            ],
        });

        new k8s.core.v1.Secret("github-credentials", {
                metadata: {
                    name: "ghcr-auth",
                    namespace: buildNamespace.metadata.name,
                },
                stringData: {
                    "config.json": pulumi.jsonStringify({
                        "auths": {
                            "ghcr.io": {
                                "auth": config.requireSecret("ghcr-auth"),
                            }
                        }
                    }),
                }
            },
            {
                parent: this,
                dependsOn:
                    [
                        tektonOperator,
                        buildNamespace
                    ],
            }
        );
        new k8s.networking.v1.Ingress("tekton-dashboard", {
            metadata: {
                name: "tekton-dashboard",
                namespace: "tekton-pipelines",
                annotations: {
                    "external-dns.alpha.kubernetes.io/hostname": "tekton.ediri.online",
                    "external-dns.alpha.kubernetes.io/ttl": "60",
                    "nginx.ingress.kubernetes.io/ssl-redirect": "false",
                }
            },
            spec: {
                ingressClassName: "nginx",
                rules: [
                    {
                        host: "tekton.ediri.online",
                        http: {
                            paths: [
                                {
                                    path: "/",
                                    pathType: "Prefix",
                                    backend: {
                                        service: {
                                            name: "tekton-dashboard",
                                            port: {
                                                number: 9097
                                            }
                                        }
                                    }
                                }
                            ]
                        },
                    }
                ]
            },
        }, {
            parent: this,
            dependsOn: tektonAllComponents,
        });
    }
}
