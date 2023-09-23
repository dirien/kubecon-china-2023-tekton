import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import {local} from "@pulumi/command";
import * as docker from "@pulumi/docker";

export class Backstage extends pulumi.ComponentResource {
    public readonly imageName: pulumi.Output<string>;
    public readonly repoDigest: pulumi.Output<string>;

    constructor(name: string,
                opts: pulumi.ComponentResourceOptions = {}) {
        super("pkg:index:Backstage", name, {}, opts);
        const backstageBuild = new local.Command("backstage-build", {
            dir: "./backstage",
            create: "yarn install && yarn tsc && yarn build:backend",
            update: "yarn install && yarn tsc && yarn build:backend",
        }, {
            parent: this,
        });

        const backstageImage = new docker.Image("backstage", {
            build: {
                context: "./backstage",
                platform: "linux/amd64",
                builderVersion: docker.BuilderVersion.BuilderBuildKit,
                dockerfile: "./backstage/packages/backend/Dockerfile",
            },
            imageName: "backstage/backstage",
            skipPush: true,
        }, {
            parent: this,
            dependsOn: backstageBuild,
        });

        const backstage = new k8s.helm.v3.Release("backstage", {
            chart: "backstage",
            name: "backstage",
            version: "1.3.0",
            repositoryOpts: {
                repo: "https://backstage.github.io/charts",
            },
            createNamespace: true,
            namespace: "backstage",
            values: {
                backstage: {
                    image: {
                        registry: "docker.io",
                        repository: backstageImage.imageName,
                        pullPolicy: "IfNotPresent",
                    },
                    command: ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
                },
                ingress: {
                    enabled: true,
                    className: "nginx",
                },
                service: {
                    type: "LoadBalancer"
                }
            },
        }, {
            parent: this,
        });

        this.imageName = backstageImage.imageName
        this.repoDigest = backstageImage.repoDigest
    }
}
