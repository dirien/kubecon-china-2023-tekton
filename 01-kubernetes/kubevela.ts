import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import {local} from "@pulumi/command";

export class KubeVela extends pulumi.ComponentResource {

    constructor(name: string,
                opts: pulumi.ComponentResourceOptions = {}) {
        super("pkg:index:KubeVela", name, {}, opts);
        const kubevela = new k8s.helm.v3.Release("kubevela", {
            chart: "vela-core",
            version: "1.9.6",
            repositoryOpts: {
                repo: "https://kubevela.github.io/charts",
            },
            createNamespace: true,
            namespace: "vela-system",
        }, {
            parent: this,
        });

        const velaux = new k8s.yaml.ConfigFile("velaux", {
            file: ".velaux/addon-manifest.yaml",
            skipAwait: true,
        }, {
            parent: this,
            dependsOn: [
                kubevela,
            ],
        });

        new k8s.networking.v1.IngressPatch("vela-ingress-patch", {
            metadata: {
                name: "velaux-server",
                namespace: kubevela.namespace,
                annotations: {
                    "external-dns.alpha.kubernetes.io/hostname": "velaux.ediri.online",
                    "external-dns.alpha.kubernetes.io/ttl": "60",
                }
            }
        }, {
            parent: this,
            dependsOn: [
                velaux,
            ],
        });
    }
}
