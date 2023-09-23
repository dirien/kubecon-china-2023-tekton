import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";

let publicSubnetCIDRs: string[] = [
    "10.0.0.0/27",
    "10.0.0.32/27"
];

let availabilityZones: string[] = [
    "eu-central-1a",
    "eu-central-1b"
];

const clusterName = "kubecon-china-2023-cluster";

// Create a VPC for our cluster.
const vpc = new aws.ec2.Vpc("kubecon-china-2023-vpc", {
    cidrBlock: "10.0.0.0/24",
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
    instanceType: "t3.medium",
    desiredCapacity: 2,
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

export const kubeconfig = pulumi.secret(cluster.kubeconfig);
