import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import {local} from "@pulumi/command";

export interface KyvernoArgs {
    installReporter?: boolean;
    kyvernoTektonPolicies?: string[];
}

export class Kyverno extends pulumi.ComponentResource {
    installReporter?: boolean;
    kyvernoTektonPolicies?: string[];

    constructor(name: string,
                args: KyvernoArgs,
                opts: pulumi.ComponentResourceOptions = {}) {
        super("pkg:index:Kyverno", name, {}, opts);

        this.installReporter = args.installReporter || false;
        this.kyvernoTektonPolicies = args.kyvernoTektonPolicies || [];

        const kyverno = new k8s.helm.v3.Release("kyverno", {
            chart: "kyverno",
            version: "3.0.5",
            repositoryOpts: {
                repo: "https://kyverno.github.io/kyverno/",
            },
            namespace: "compliance",
            createNamespace: true,
            values: {
                config: {
                    resourceFilters: [
                        "[Event,*,*]",
                        "[*,kube-system,*]",
                        "[*,kube-public,*]",
                        "[*,kube-node-lease,*]",
                        "[Node,*,*]",
                        "[APIService,*,*]",
                        "[TokenReview,*,*]",
                        "[SubjectAccessReview,*,*]",
                        "[SelfSubjectAccessReview,*,*]",
                        "[*,kyverno,kyverno*]",
                        "[Binding,*,*]",
                        "[ReplicaSet,*,*]",
                        "[ReportChangeRequest,*,*]",
                        "[ClusterReportChangeRequest,*,*]",
                        "[*,capv-system,*]",
                        "[*,capm3-system,*]",
                    ],
                }
            }
        }, {
            parent: this,
        });

        const kyvernoPolicy = new k8s.helm.v3.Release("kyverno-policy", {
            chart: "kyverno-policies",
            version: "3.0.4",
            repositoryOpts: {
                repo: "https://kyverno.github.io/kyverno/",
            },
            namespace: kyverno.namespace,
            createNamespace: false,
        }, {
            parent: this,
            dependsOn: kyverno,
        });

        if (this.installReporter) {
            new k8s.helm.v3.Release("kyverno-policy-report", {
                chart: "policy-reporter",
                version: "2.20.0",
                repositoryOpts: {
                    repo: "https://kyverno.github.io/policy-reporter/",
                },
                namespace: kyverno.namespace,
                createNamespace: false,
                values: {
                    kyvernoPlugin: {
                        enabled: true,
                    },
                    global: {
                        plugins: {
                            kyverno: true,
                        }
                    },
                    ui: {
                        enabled: true,
                    },
                }
            }, {
                parent: this,
                dependsOn: kyverno,
            });
        }

        for (const policy of this.kyvernoTektonPolicies) {
            const kyvernoTektonPolicyRequireNamespace = new k8s.yaml.ConfigFile(`kyverno-tekton-policy-${policy}`, {
                file: `https://raw.githubusercontent.com/kyverno/policies/main/tekton/${policy}/${policy}.yaml`,
            }, {
                parent: this,
                dependsOn: [
                    kyverno,
                    kyvernoPolicy,
                ]
            });
        }
    }
}
