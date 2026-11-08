/* CKS Prep - per-option rationales, Cluster Setup. Shown only after the learner submits an answer. */
window.CKS_QUIZ_WHY_1 = {
  "q-cs-1": [
    "kube-controller-manager signs an approved CSR with --cluster-signing-cert-file and its key, issuing the serving certificate.",
    "The kubelet only creates and submits the CSR; it holds no cluster signing CA, so it cannot issue its own serving certificate.",
    "etcd stores the signed certificate as cluster data, but it holds no signing CA and performs no CSR signing at all.",
    "kube-aggregator merges Extension apiservices into the main API surface and has no role in signing kubelet certificates."
  ],
  "q-cs-2": [
    "Turning off anonymous auth removes the system:anonymous group, so every request reaching the API server must authenticate.",
    "Node plus RBAC restricts each kubelet to the Secrets and ConfigMaps of the Pods it hosts and leaves everything else to RBAC.",
    "NodeRestriction limits a kubelet to its own Node object and to Pods bound to it, capping what a stolen node credential can do.",
    "This flag permits privileged Pods on control-plane nodes, so a hardened manifest sets it to false or leaves it unset.",
    "With lookup enabled the API server checks the referenced ServiceAccount still exists, so tokens for deleted accounts stop working."
  ],
  "q-cs-3": [
    "NodeRestriction binds kubelet requests to the node's own name and limits its Pod reads to those scheduled onto that node.",
    "PodSecurity validates Pod fields such as privilege escalation and host namespaces; it never governs kubelet access to Node objects.",
    "ResourceQuota caps counts and resource totals inside a namespace and has no bearing on what a kubelet may read or write.",
    "A mutating webhook with failurePolicy=Ignore rewrites objects and is skipped when it is unavailable, so it enforces nothing."
  ],
  "q-cs-4": [
    "--client-cert-auth makes etcd require a client certificate signed by --trusted-ca-file, giving mutual TLS rather than anonymous access.",
    "Binding --listen-client-urls to loopback or an internal address keeps the client port unreachable from the cluster Pod network.",
    "Pinning --listen-peer-urls to the private member network keeps replication traffic off interfaces other clients could reach.",
    "--auth-token turns on etcd's static shared token, one secret valid for every client and impossible to scope per user.",
    "--auto-tls makes etcd generate a self-signed certificate at start-up, so clients get encryption with no CA to pin or verify."
  ],
  "q-cs-5": [
    "controlPlaneEndpoint is the shared host and port kubeadm bakes into every component and kubeconfig, so all traffic hits the load balancer.",
    "localAPIEndpoint only sets the local bind address of that joining apiserver, not the address clients and kubelets dial.",
    "--advertise-address is a per-node apiserver flag announcing that node's own address; it configures no common endpoint.",
    "certSANs adds the load balancer name to the apiserver certificate so clients verify it, but nothing there points components at the endpoint."
  ],
  "q-cs-6": [
    "The API server reads an EncryptionConfiguration file through this flag and writes ciphertext to etcd, protecting Secret data at rest.",
    "etcd has no flag for this: it stores exactly the bytes the API server hands it and performs no Kubernetes Secret encryption.",
    "KubeletConfiguration governs the kubelet on a node and never touches the storage layer where Secret objects are persisted.",
    "Secret data is only base64-encoded in data and stringData, so a field on the Secret cannot change how etcd stores it."
  ],
  "q-cs-7": [
    "NetworkPolicy enforcement is delegated to the CNI; flannel and bridge accept the object but program no rules, so traffic still flows.",
    "NetworkPolicy is validated by the API server itself, not by a webhook, and enforcement has nothing to do with webhooks.",
    "Selectors match Pods by labels and namespace regardless of any Service, so a Service is neither required nor consulted.",
    "The CNI reconciles continuously, so a policy applies to Pods that already exist as soon as its selector matches them."
  ],
  "q-cs-8": [
    "--audit-policy-file names the file that decides which requests are recorded and at what level, so without it there is no output.",
    "--audit-log-path writes events to a file, or --audit-webhook-config-file streams them to a remote endpoint; one is needed to get events out.",
    "--audit-log-maxage, --audit-log-maxbackup and --audit-log-maxsize cap audit output before a busy cluster fills the node disk.",
    "The only accepted webhook modes are Batched and Metadata, so BlockUntilAcked makes the apiserver fail on its own flag at start-up.",
    "Audit is apiserver logging rather than an admission plugin, so an Audit entry in that list names a plugin that does not exist."
  ]
};
