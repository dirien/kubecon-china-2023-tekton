import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import {local} from "@pulumi/command";


export class ExternalDNS extends pulumi.ComponentResource {

    constructor(name: string,
                opts: pulumi.ComponentResourceOptions = {}) {
        super("pkg:index:ExternalDNS", name, {}, opts);
        let config = new pulumi.Config();
        const ns = new k8s.core.v1.Namespace("external-dns-ns", {
            metadata: {
                name: "external-dns",
            }
        }, {
            parent: this,
        })

        const externalDnsCredential = new k8s.core.v1.Secret("external-dns-credential", {
            metadata: {
                name: "external-dns-credentials",
                namespace: ns.metadata.name,
            },
            stringData: {
                "do_token": config.requireSecret("do-token"),
            },
            type: "Opaque",
        }, {
            parent: this,
            dependsOn: ns,
        });

        new k8s.helm.v3.Release("external-dns", {
            chart: "external-dns",
            version: "1.13.1",
            repositoryOpts: {
                repo: "https://kubernetes-sigs.github.io/external-dns",
            },
            namespace: ns.metadata.name,
            createNamespace: false,
            values: {
                env: [{
                    name: "DO_TOKEN",
                    valueFrom: {
                        secretKeyRef: {
                            name: externalDnsCredential.metadata.name,
                            key: "do_token",
                        }
                    }
                }],
                provider: "digitalocean",
                sources: [
                    "ingress",
                    "service"
                ],
            }
        }, {
            parent: this,
        });
    }
}
