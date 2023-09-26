import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";

let publicSubnetCIDRs: string[] = [
    "10.0.0.0/20",
    "10.0.32.0/20"
];

let availabilityZones: string[] = [
    "eu-central-1a",
    "eu-central-1b"
];

const clusterName = "kubecon-china-2023-cluster";

// Create a VPC for our cluster.
const vpc = new aws.ec2.Vpc("kubecon-china-2023-vpc", {
    cidrBlock: "10.0.0.0/16",
});

const igw = new aws.ec2.InternetGateway("kubecon-china-2023-igw", {
    vpcId: vpc.id,
});

const rt = new aws.ec2.RouteTable("kubecon-china-2023-rt", {
    vpcId: vpc.id,
    routes: [
        {
            cidrBlock: "0.0.0.0/0",
            gatewayId: igw.id,
        }
    ]
});

let privateSubnets: pulumi.Output<string>[] = [];

for (let i = 0; i < publicSubnetCIDRs.length; i++) {
    const subnet = new aws.ec2.Subnet(`kubecon-china-2023-public-subnet-${i}`, {
        vpcId: vpc.id,
        cidrBlock: publicSubnetCIDRs[i],
        mapPublicIpOnLaunch: false,
        assignIpv6AddressOnCreation: false,
        availabilityZone: availabilityZones[i],
        tags: {
            Name: `kubecon-china-2023-public-subnet-${i}`,
        }
    });
    new aws.ec2.RouteTableAssociation(`kubecon-china-2023-rt-assoc-${i}`, {
        subnetId: subnet.id,
        routeTableId: rt.id,
    });
    privateSubnets.push(subnet.id);
}

const cluster = new eks.Cluster("kubecon-china-2023-cluster", {
    name: clusterName,
    vpcId: vpc.id,
    privateSubnetIds: privateSubnets,
    endpointPublicAccess: true,
    instanceType: "t3.xlarge",
    desiredCapacity: 3,
    minSize: 1,
    maxSize: 3,
    providerCredentialOpts: {
        profileName: "default",
    },
    createOidcProvider: true,
});


// @ts-ignore
const assumeRolePolicy = pulumi.all([cluster.core.oidcProvider.arn, cluster.core.oidcProvider.url])
    .apply(([arn, url]) =>
        aws.iam.getPolicyDocumentOutput({
            statements: [{
                effect: "Allow",
                actions: ["sts:AssumeRoleWithWebIdentity"],
                principals: [
                    {
                        type: "Federated",
                        identifiers: [
                            arn
                        ],
                    },
                ],
                conditions: [
                    {
                        test: "StringEquals",
                        variable: `${url.replace('https://', '')}:sub`,
                        values: ["system:serviceaccount:kube-system:aws-node"],
                    },
                    {
                        test: "StringEquals",
                        variable: `${url.replace('https://', '')}:aud`,
                        values: ["sts.amazonaws.com"],
                    }
                ],
            }],
        })
    );

const vpcRole = new aws.iam.Role("kubecon-china-2023-eks-vpc-cni-role", {
    assumeRolePolicy: assumeRolePolicy.json,
});

const vpcRolePolicy = new aws.iam.RolePolicyAttachment("kubecon-china-2023-eks-vpc-cni-role-policy", {
    role: vpcRole,
    policyArn: "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
});

const vpcCniAddon = new aws.eks.Addon("kubecon-china-2023-vpc-cni", {
    clusterName: cluster.eksCluster.name,
    addonName: "vpc-cni",
    addonVersion: "v1.15.0-eksbuild.2",
    resolveConflicts: "OVERWRITE",
    configurationValues: pulumi.jsonStringify({
        "enableNetworkPolicy": "true",
    }),
    serviceAccountRoleArn: vpcRole.arn,
});

export const vpcCniAddonName = vpcCniAddon.addonName;

// @ts-ignore
const assumeEBSRolePolicy = pulumi.all([cluster.core.oidcProvider.arn, cluster.core.oidcProvider.url])
    .apply(([arn, url]) =>
        aws.iam.getPolicyDocumentOutput({
            statements: [{
                effect: "Allow",
                actions: ["sts:AssumeRoleWithWebIdentity"],
                principals: [
                    {
                        type: "Federated",
                        identifiers: [
                            arn
                        ],
                    },
                ],
                conditions: [
                    {
                        test: "StringEquals",
                        variable: `${url.replace('https://', '')}:sub`,
                        values: ["system:serviceaccount:kube-system:ebs-csi-controller-sa"],
                    },
                    {
                        test: "StringEquals",
                        variable: `${url.replace('https://', '')}:aud`,
                        values: ["sts.amazonaws.com"],
                    }
                ],
            }],
        })
    );

const ebsRole = new aws.iam.Role("kubecon-china-2023-eks-ebsi-role", {
    assumeRolePolicy: assumeEBSRolePolicy.json,
});

const ebsRolePolicy = new aws.iam.RolePolicyAttachment("kubecon-china-2023-eks-ebs-role-policy", {
    role: ebsRole,
    policyArn: "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy",
});

const provider = new k8s.Provider("kubecon-china-2023-k8s", {
    kubeconfig: cluster.kubeconfigJson,
    enableServerSideApply: true,
});

new k8s.helm.v3.Release("aws-ebs-csi-driver", {
    chart: "aws-ebs-csi-driver",
    version: "2.23.0",
    namespace: "kube-system",
    repositoryOpts: {
        repo: "https://kubernetes-sigs.github.io/aws-ebs-csi-driver",
    },
    values: {
        controller: {
            serviceAccount: {
                annotations: {
                    "eks.amazonaws.com/role-arn": ebsRole.arn,
                }
            }
        }
    }
}, {
    provider: provider,
})

export const kubeconfig = pulumi.secret(cluster.kubeconfig);


const repo = new aws.ecr.Repository("backstage", {
    name: "kubecon-china-backstage",
    forceDelete: true,
});

// Get registry info (creds and endpoint) so we can build/publish to it.
const registryInfo = repo.registryId.apply(async id => {
    const credentials = await aws.ecr.getCredentials({registryId: id});
    const decodedCredentials = Buffer.from(credentials.authorizationToken, "base64").toString();
    const [username, password] = decodedCredentials.split(":");
    if (!password || !username) {
        throw new Error("Invalid credentials");
    }
    return {
        server: credentials.proxyEndpoint,
        username: username,
        password: password,
    };
});

export const registryServer = registryInfo.server;
export const registryUsername = registryInfo.username;
export const registryPassword = pulumi.secret(registryInfo.password);
export const imageRepo = repo.repositoryUrl;
