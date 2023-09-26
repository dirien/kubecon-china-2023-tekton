import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import {local} from "@pulumi/command";
import * as docker from "@pulumi/docker";


export interface RegistryArgs {
    username: pulumi.Input<string>;
    password: pulumi.Input<string>;
    server: pulumi.Input<string>;
}

export interface BackstageArgs {
    registry?: RegistryArgs;
    imageRepo?: pulumi.Input<string>;
}

export class Backstage extends pulumi.ComponentResource {
    public readonly imageName: pulumi.Output<string>;
    public readonly repoDigest: pulumi.Output<string>;

    constructor(name: string,
                args?: BackstageArgs,
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
            imageName: args?.imageRepo || "backstage/backstage",
            skipPush: args?.registry === undefined,
            registry: args?.registry ? {
                server: args.registry.server,
                username: args.registry.username,
                password: args.registry.password,
            } : undefined,
        }, {
            parent: this,
            dependsOn: backstageBuild,
        });

        new k8s.helm.v3.Release("backstage", {
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
                        registry: args?.imageRepo ? backstageImage.imageName.apply(i => i.split("/")[0]) : "docker.io",
                        repository: args?.imageRepo ? backstageImage.imageName.apply(i => i.split("/")[1]) : backstageImage.imageName,
                        pullPolicy: "Always",
                    },
                    command: ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
                },
                ingress: {
                    enabled: true,
                    className: "nginx",
                    host: "backstage.ediri.online",
                    annotations: {
                        "external-dns.alpha.kubernetes.io/hostname": "backstage.ediri.online",
                        "external-dns.alpha.kubernetes.io/ttl": "60",
                    }
                },
                service: {
                    type: "LoadBalancer",
                    annotations: {
                        "external-dns.alpha.kubernetes.io/hostname": "backstage-api.ediri.online",
                        "external-dns.alpha.kubernetes.io/ttl": "60",
                        "nginx.ingress.kubernetes.io/ssl-redirect": "false",
                    }
                }
            },
        }, {
            parent: this,
        });

        this.imageName = backstageImage.imageName
        this.repoDigest = backstageImage.repoDigest
    }
}
