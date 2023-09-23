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

        new local.Command("velaux", {
            create: "vela addon enable velaux serviceType=LoadBalancer"
        }, {
            parent: this,
            dependsOn: kubevela,
        });
    }
}
