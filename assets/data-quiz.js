/*
 * CKS Prep - question bank for the knowledge part of the mock exam and for practice drills.
 * type: "single" = one correct option, "multi" = several correct options (all must be picked).
 * Every option carries ok:true/false; explain is shown after answering.
 */

window.CKS_QUIZ = [

/* ---------------- Cluster Setup (15%) ---------------- */
{
  id: "q-cs-1", domain: "cluster-setup", type: "single", difficulty: "medium",
  tags: ["kubeadm", "certificates"],
  q: "During a kubeadm join, the new kubelet sends a Certificate Signing Request for its serving certificate. Which component actually signs it?",
  options: [
    { t: "kube-controller-manager, using the cluster signing certificate", ok: true },
    { t: "kubelet, which self-signs a self-signed certificate", ok: false },
    { t: "etcd, because certificates are stored there", ok: false },
    { t: "the API server aggregator (kube-aggregator)", ok: false }
  ],
  explain: "The CSR is approved by a ClusterRoleBinding on system:csr-approver, then signed by kube-controller-manager with --cluster-signing-cert-file/--cluster-signing-key-file. The kubelet never signs its own serving certificate."
},
{
  id: "q-cs-2", domain: "cluster-setup", type: "multi", difficulty: "hard",
  tags: ["kube-apiserver", "hardening"],
  q: "You must shrink the API server's attack surface on a self-managed control plane. Which settings are correct hardening measures? (pick all that apply)",
  options: [
    { t: "--anonymous-auth=false", ok: true },
    { t: "--authorization-mode=Node,RBAC", ok: true },
    { t: "--enable-admission-plugins=NodeRestriction", ok: true },
    { t: "--allow-privileged=true", ok: false },
    { t: "--service-account-lookup=true", ok: true }
  ],
  explain: "--allow-privileged should be false (or unset) so privileged Pods cannot be created on the control plane. --service-account-lookup=true makes the API server verify that a referenced ServiceAccount still exists, which kills a token reuse path."
},
{
  id: "q-cs-3", domain: "cluster-setup", type: "single", difficulty: "medium",
  tags: ["admission", "noderestriction"],
  q: "Which admission plugin restricts a kubelet so it can only register and read the Node object for its own instance and only Pods scheduled to itself?",
  options: [
    { t: "NodeRestriction", ok: true },
    { t: "PodSecurity", ok: false },
    { t: "ResourceQuota", ok: false },
    { t: "MutatingAdmissionWebhook with failurePolicy=Ignore", ok: false }
  ],
  explain: "NodeRestriction is the standard answer for 'a compromised node cannot poison other nodes' questions. It is listed in --enable-admission-plugins and is enabled in kubeadm clusters."
},
{
  id: "q-cs-4", domain: "cluster-setup", type: "multi", difficulty: "hard",
  tags: ["etcd"],
  q: "etcd for a CKS cluster must not be reachable by arbitrary clients. Which measures belong in an etcd hardening answer?",
  options: [
    { t: "--client-cert-auth together with --trusted-ca-file so clients need a CA-signed certificate", ok: true },
    { t: "--listen-client-urls bound to the internal/loopback interface instead of 0.0.0.0", ok: true },
    { t: "--listen-peer-urls bound to the private network used by etcd members", ok: true },
    { t: "--auth-token=... so clients authenticate with a shared static token", ok: false },
    { t: "--auto-tls so etcd generates its own certificate at start-up", ok: false }
  ],
  explain: "etcd hardening in this exam means mutual TLS with a private CA on internal interfaces. --auto-tls (untrusted self-signed certs) and static shared tokens are exactly what a hardened cluster removes."
},
{
  id: "q-cs-5", domain: "cluster-setup", type: "single", difficulty: "medium",
  tags: ["kubeadm", "ha"],
  q: "For a 3-control-plane cluster behind an internal load balancer with one DNS name, which kubeadm configuration value makes all control-plane components use that endpoint?",
  options: [
    { t: "controlPlaneEndpoint in the InitConfiguration", ok: true },
    { t: "localAPIEndpoint in the JoinConfiguration", ok: false },
    { t: "--advertise-address on every kube-apiserver", ok: false },
    { t: "apiServer.certSANs only", ok: false }
  ],
  explain: "controlPlaneEndpoint is the shared address (LB or DNS name plus port) that every control-plane node is initialised with. localAPIEndpoint is the node-local address; --advertise-address is the per-node bind address. certSANs matters too, but it does not set the endpoint."
},
{
  id: "q-cs-6", domain: "cluster-setup", type: "single", difficulty: "medium",
  tags: ["encryption", "secrets"],
  q: "Where is Kubernetes Secret data encrypted at rest configured?",
  options: [
    { t: "kube-apiserver, with --encryption-provider-config", ok: true },
    { t: "etcd, with --encryption-at-rest", ok: false },
    { t: "kubelet, in /var/lib/kubelet/config.yaml", ok: false },
    { t: "the Secret object itself, with encryption: AES-CBC", ok: false }
  ],
  explain: "Encryption at rest is an API server feature: the API server encrypts before writing to etcd, using an EncryptionConfiguration file. Secrets by themselves are only base64-encoded."
},
{
  id: "q-cs-7", domain: "cluster-setup", type: "single", difficulty: "easy",
  tags: ["networkpolicy", "cni"],
  q: "You apply a NetworkPolicy and it silently does nothing. What is the most common cause?",
  options: [
    { t: "The CNI plugin in use does not implement NetworkPolicy (for example flannel or bridge)", ok: true },
    { t: "NetworkPolicy requires a validating webhook to be installed", ok: false },
    { t: "NetworkPolicy only works on Pods with a Service", ok: false },
    { t: "The policy must be created before the Pods exist", ok: false }
  ],
  explain: "NetworkPolicy is enforced by the CNI, not by the API server. kubeadm's default bridge/flannel accept the object but do not enforce it - install Calico/Cilium and verify with a test Pod."
},
{
  id: "q-cs-8", domain: "cluster-setup", type: "multi", difficulty: "hard",
  tags: ["audit", "apiserver"],
  q: "Which kube-apiserver flags are required to get usable Kubernetes audit logs? (pick all that apply)",
  options: [
    { t: "--audit-policy-file", ok: true },
    { t: "--audit-log-path (or --audit-webhook-config-file)", ok: true },
    { t: "--audit-log-maxage / --audit-log-maxbackup / --audit-log-maxsize for retention", ok: true },
    { t: "--audit-webhook-mode=BlockUntilAcked", ok: false },
    { t: "--enable-admission-plugins=Audit", ok: false }
  ],
  explain: "Audit is not an admission plugin: it is API server logging. The valid webhook modes are Batched and Metadata. Retention flags matter because a busy cluster fills the disk."
},

/* ---------------- Cluster Hardening (15%) ---------------- */
{
  id: "q-ch-1", domain: "cluster-hardening", type: "single", difficulty: "medium",
  tags: ["rbac", "least-privilege"],
  q: "A ServiceAccount in namespace 'app' must read Pods in 'app' only. Which objects do you create?",
  options: [
    { t: "A Role with verbs [get, list, watch] on pods, plus a RoleBinding in namespace app", ok: true },
    { t: "A ClusterRole plus a ClusterRoleBinding so the rule is visible cluster-wide", ok: false },
    { t: "A Role plus a ClusterRoleBinding, because RoleBindings cannot target ServiceAccounts", ok: false },
    { t: "An aggregated ClusterRole using label selectors", ok: false }
  ],
  explain: "Namespace scope means Role + RoleBinding. A ClusterRoleBinding would widen it; RoleBindings can absolutely bind ServiceAccounts from their own namespace."
},
{
  id: "q-ch-2", domain: "cluster-hardening", type: "single", difficulty: "hard",
  tags: ["rbac", "escalation"],
  q: "You want to let a user create Deployments but never grant permissions they do not already have. What makes RBAC prevent that escalation?",
  options: [
    { t: "Granting rights a user does not themselves hold requires the bind and escalate verbs, which you withhold", ok: true },
    { t: "Deployments are namespaced resources, so escalation is impossible by definition", ok: false },
    { t: "PodSecurity admission blocks RBAC changes", ok: false },
    { t: "The API server refuses any ClusterRole created by a non-admin", ok: false }
  ],
  explain: "RBAC escalation prevention: to bind an existing ClusterRole you need 'bind' on that role (and 'escalate' to raise privileges). This is why 'can I give someone cluster-admin?' tasks hinge on those verbs."
},
{
  id: "q-ch-3", domain: "cluster-hardening", type: "single", difficulty: "medium",
  tags: ["serviceaccount", "tokens"],
  q: "Which credential design gives a Pod an API credential that is bound to one Pod, one audience and a short lifetime?",
  options: [
    { t: "A projected service account token volume with audience and expirationTimestamp", ok: true },
    { t: "The default automounted token in /var/run/secrets/kubernetes.io/serviceaccount", ok: false },
    { t: "A Secret of type kubernetes.io/service-account-token mounted into the Pod", ok: false },
    { t: "A kubeconfig generated by kubectl create token --decode", ok: false }
  ],
  explain: "Bound tokens are scoped to the Pod and audience and expire. Legacy SA token Secrets are static, cluster-wide valid until deleted, and are the thing hardening tasks remove (automountServiceAccountToken: false plus explicit projection)."
},
{
  id: "q-ch-4", domain: "cluster-hardening", type: "single", difficulty: "medium",
  tags: ["kubelet", "kube-bench"],
  q: "kube-bench reports that the kubelet serves an unauthenticated read-only endpoint. Where do you change the setting on a kubeadm node?",
  options: [
    { t: "/var/lib/kubelet/config.yaml - set readOnlyPort: 0 and anonymousAuth: false", ok: true },
    { t: "/etc/kubernetes/manifests/kube-apiserver.yaml", ok: false },
    { t: "The kubelet's command line in kubelet.service only", ok: false },
    { t: "A ConfigMap named kubelet-config in kube-system", ok: false }
  ],
  explain: "On kubeadm clusters the kubelet reads KubeletConfiguration from /var/lib/kubelet/config.yaml; restart the kubelet after editing. readOnlyPort 10255 was the classic unauthenticated surface."
},
{
  id: "q-ch-5", domain: "cluster-hardening", type: "multi", difficulty: "hard",
  tags: ["kubelet", "hardening"],
  q: "Which KubeletConfiguration values harden the kubelet? (pick all that apply)",
  options: [
    { t: "anonymousAuth: false", ok: true },
    { t: "readOnlyPort: 0", ok: true },
    { t: "clientCAFile pointing at the cluster CA so kubelet clients are CA-authenticated", ok: true },
    { t: "authorizationMode: AlwaysAllow", ok: false },
    { t: "streamingConnectionIdleTimeout: 0", ok: false }
  ],
  explain: "Authorization should be Webhook (with Node authorization), not AlwaysAllow. A zero idle timeout for streaming connections keeps sessions open indefinitely - not hardening."
},
{
  id: "q-ch-6", domain: "cluster-hardening", type: "single", difficulty: "medium",
  tags: ["rbac", "verify"],
  q: "How do you prove what permissions a specific ServiceAccount really has before a grader asks?",
  options: [
    { t: "kubectl auth can-i --list --as=system:serviceaccount:NAMESPACE:NAME", ok: true },
    { t: "kubectl get role -o yaml", ok: false },
    { t: "kubectl describe serviceaccount NAME", ok: false },
    { t: "kubectl get clusterroles -o wide", ok: false }
  ],
  explain: "kubectl auth can-i resolves the effective set through every binding and aggregation. Listing Role objects alone does not tell you who is bound to them."
},
{
  id: "q-ch-7", domain: "cluster-hardening", type: "single", difficulty: "hard",
  tags: ["upgrade", "order"],
  q: "For a kubeadm cluster being upgraded to a new minor version, what is the correct order?",
  options: [
    { t: "Upgrade the control-plane node (kubeadm upgrade apply), then its kubelet and kubectl, then each remaining control-plane node, then worker nodes", ok: true },
    { t: "Upgrade every kubelet first, then the control plane at the end", ok: false },
    { t: "Delete and recreate the cluster from a new kubeadm init, restoring from etcd snapshot", ok: false },
    { t: "Upgrade worker nodes first so the API server can be replaced without downtime", ok: false }
  ],
  explain: "kubeadm enforces version skew (kubelet not newer than the API server). Control plane first with 'kubeadm upgrade apply' on the first node and 'kubeadm upgrade node' on the others, then kubelet/kubeadm package upgrades plus restart on every node."
},
{
  id: "q-ch-8", domain: "cluster-hardening", type: "single", difficulty: "medium",
  tags: ["auditlog", "etcd"],
  q: "A task asks you to reduce how much sensitive data etcd holds. Which action fits?",
  options: [
    { t: "Enable API server encryption at rest for secrets (and configmaps where required)", ok: true },
    { t: "Set etcd --quota-backend-bytes to a very small value", ok: false },
    { t: "Disable the Kubernetes API aggregator", ok: false },
    { t: "Store Secrets in a Deployment annotation instead of a Secret object", ok: false }
  ],
  explain: "The scored answer is encryption at rest with the strongest provider first. Moving secrets into annotations makes the problem worse - annotations are readable by anyone who can read the workload."
},

/* ---------------- System Hardening (10%) ---------------- */
{
  id: "q-sh-1", domain: "system-hardening", type: "multi", difficulty: "medium",
  tags: ["os", "attack-surface"],
  q: "Which actions genuinely reduce the operating-system attack surface of a worker node? (pick all that apply)",
  options: [
    { t: "Install only the packages the node role needs and remove compilers and debug tools", ok: true },
    { t: "Disable kernel modules the workloads never use", ok: true },
    { t: "Bind management services (SSH, metrics) to the internal interface and firewall them", ok: true },
    { t: "Enable password authentication for root over SSH for emergency access", ok: false },
    { t: "Apply a minimal, periodically rebuilt node image instead of long-lived hand-patched hosts", ok: true }
  ],
  explain: "Root password SSH is the opposite of hardening: key-only, no root login, and jump-host/VPN access. Immutable rebuilt images are how you keep patch state auditable."
},
{
  id: "q-sh-2", domain: "system-hardening", type: "single", difficulty: "medium",
  tags: ["iam"],
  q: "For managed nodes in a cloud provider, what does 'least privilege' mean in practice?",
  options: [
    { t: "A separate, narrowly scoped IAM role per node pool, with instance-profile permissions limited to what the node needs", ok: true },
    { t: "One cluster-wide IAM role with PowerUser access so nothing breaks", ok: false },
    { t: "Long-lived access keys stored in a Secret for the node bootstrap", ok: false },
    { t: "Granting the CI pipeline the same role as the nodes", ok: false }
  ],
  explain: "Scope per node pool, prefer instance profiles / workload identity over static keys, and keep the CI identity separate from the node identity so a leaked build cannot read node credentials."
},
{
  id: "q-sh-3", domain: "system-hardening", type: "single", difficulty: "medium",
  tags: ["apparmor"],
  q: "How do you attach a custom AppArmor profile to one container in a modern cluster?",
  options: [
    { t: "Load the profile on the node, then set securityContext.appArmorProfile: { type: Localhost, localhostProfile: myprofile }", ok: true },
    { t: "Set container.apparmor.security.beta.kubernetes.io annotations only - that is the supported way", ok: false },
    { t: "Set seccompProfile: { type: Localhost } with the AppArmor file name", ok: false },
    { t: "AppArmor profiles can only be applied cluster-wide with a DaemonSet", ok: false }
  ],
  explain: "The securityContext field is the supported path; the old beta annotation is deprecated. The profile file must exist on the node (typically under the local AppArmor profile directory) and AppArmor must be enabled in the kernel."
},
{
  id: "q-sh-4", domain: "system-hardening", type: "single", difficulty: "easy",
  tags: ["seccomp"],
  q: "You must confine syscalls for a container without writing a custom profile. What do you set?",
  options: [
    { t: "securityContext.seccompProfile.type: RuntimeDefault", ok: true },
    { t: "securityContext.capabilities.drop: [\"ALL\"] alone", ok: false },
    { t: "A PodSecurity 'restricted' namespace label alone", ok: false },
    { t: "privileged: false alone", ok: false }
  ],
  explain: "Capabilities are not syscalls. RuntimeDefault is the runtime's default seccomp profile (runc's), which is what 'restricted' also requires - you still have to name it explicitly in the Pod."
},
{
  id: "q-sh-5", domain: "system-hardening", type: "single", difficulty: "medium",
  tags: ["seccomp", "custom"],
  q: "A custom seccomp profile for the runtime-default base plus an extra allowed syscall is written as a JSON profile. Which structure is correct?",
  options: [
    { t: "defaultAction: SCMP_ACT_ERRNO, with a syscalls list starting from the base profile plus your added action", ok: true },
    { t: "defaultAction: SCMP_ACT_ALLOW, with no syscalls list", ok: false },
    { t: "defaultAction: SCMP_ACT_KILL, with one syscall entry", ok: false },
    { t: "An allowlist of capabilities instead of syscalls", ok: false }
  ],
  explain: "A custom profile is a full replacement, so you start from the runtime default profile and add to it. SCMP_ACT_ALLOW with no list disables confinement. Capabilities are a different control."
},
{
  id: "q-sh-6", domain: "system-hardening", type: "single", difficulty: "medium",
  tags: ["external-access"],
  q: "Cluster administrators must reach an internal cluster from outside the network. What is the hardened pattern?",
  options: [
    { t: "API server behind a private endpoint, reached via VPN or a bastion, with short-lived, RBAC-scoped kubeconfig credentials", ok: true },
    { t: "Expose the API server on a public load balancer with anonymous auth for read access", ok: false },
    { t: "Share one cluster-admin kubeconfig among all operators", ok: false },
    { t: "Run kubectl proxy on a public host so operators can use the dashboard", ok: false }
  ],
  explain: "kubectl proxy inherits the caller's credentials and is a well-known footgun. Private endpoint plus VPN/bastion plus per-identity short-lived credentials is the answer."
},

/* ---------------- Minimize Microservice Vulnerabilities (20%) ---------------- */
{
  id: "q-ms-1", domain: "microservices", type: "multi", difficulty: "medium",
  tags: ["psa", "restricted"],
  q: "Which requirements are part of the Pod Security Standard 'restricted' level? (pick all that apply)",
  options: [
    { t: "allowPrivilegeEscalation: false", ok: true },
    { t: "runAsNonRoot: true (or a non-zero runAsUser)", ok: true },
    { t: "seccompProfile type RuntimeDefault or Localhost", ok: true },
    { t: "capabilities.drop: [\"ALL\"] with only allowed capabilities added back", ok: true },
    { t: "readOnlyRootFilesystem: true", ok: false }
  ],
  explain: "readOnlyRootFilesystem is good practice but is not a PSA requirement - a common wrong answer. 'restricted' = 'baseline' plus the compliance half (non-root, no privilege escalation, limited capabilities, seccomp)."
},
{
  id: "q-ms-2", domain: "microservices", type: "single", difficulty: "easy",
  tags: ["psa", "labels"],
  q: "A namespace label makes the API server reject a non-compliant Pod. Which label key drives that?",
  options: [
    { t: "pod-security.kubernetes.io/enforce", ok: true },
    { t: "pod-security.kubernetes.io/audit", ok: false },
    { t: "pod-security.kubernetes.io/warn", ok: false },
    { t: "pod-security.kubernetes.io/mode", ok: false }
  ],
  explain: "enforce rejects; audit writes warning events; warn returns warnings to kubectl. Rollout order is normally warn/audit first, then enforce."
},
{
  id: "q-ms-3", domain: "microservices", type: "single", difficulty: "medium",
  tags: ["psp", "admission"],
  q: "A legacy manifest contains a PodSecurityPolicy. What should you do with it in a current cluster?",
  options: [
    { t: "Delete it - PodSecurityPolicy was removed in v1.25; replace it with PodSecurity namespace labels, Kyverno or Gatekeeper", ok: true },
    { t: "Keep it and add --enable-admission-plugins=PodSecurityPolicy", ok: false },
    { t: "Convert it into a NetworkPolicy with the same rules", ok: false },
    { t: "Keep it only for kube-system workloads", ok: false }
  ],
  explain: "Writing a PSP in the exam scores nothing and wastes minutes. The modern replacements are PSA/PodSecurity and a policy engine."
},
{
  id: "q-ms-4", domain: "microservices", type: "multi", difficulty: "medium",
  tags: ["kyverno", "opa"],
  q: "Which statements about Kyverno and OPA Gatekeeper are correct? (pick all that apply)",
  options: [
    { t: "Kyverno policies are ordinary Kubernetes YAML resources (ClusterPolicy / Policy)", ok: true },
    { t: "Gatekeeper enforces policy through a ConstraintTemplate plus Constraint instances", ok: true },
    { t: "Both are implemented as admission webhooks, so a broken webhook can block workload creation", ok: true },
    { t: "Kyverno requires policies to be written in Rego", ok: false }
  ],
  explain: "Rego is OPA's language. Kyverno's pattern language is YAML-based. Because both are admission webhooks, failurePolicy and namespace exclusions are part of a safe rollout."
},
{
  id: "q-ms-5", domain: "microservices", type: "single", difficulty: "medium",
  tags: ["policy", "testing"],
  q: "You must confirm a new validating policy rejects a bad Deployment without leaving anything running in the cluster. Which command?",
  options: [
    { t: "kubectl apply -f bad.yaml --dry-run=server", ok: true },
    { t: "kubectl apply -f bad.yaml --dry-run=client", ok: false },
    { t: "kubectl create -f bad.yaml --validate=false", ok: false },
    { t: "kubectl diff -f bad.yaml", ok: false }
  ],
  explain: "--dry-run=server sends the object through the real admission chain, so webhook-based denials appear. --dry-run=client only checks the manifest locally."
},
{
  id: "q-ms-6", domain: "microservices", type: "multi", difficulty: "hard",
  tags: ["encryption"],
  q: "Which steps are required to enable encryption at rest for Secrets on a kubeadm cluster? (pick all that apply)",
  options: [
    { t: "Create an EncryptionConfiguration file with aescbc first and identity last", ok: true },
    { t: "Add --encryption-provider-config to the kube-apiserver static pod manifest", ok: true },
    { t: "Make the config file readable by the API server container (hostPath volume mount)", ok: true },
    { t: "Rewrite existing Secrets (kubectl get secrets -A -o json | kubectl replace -f -) so they are re-encrypted", ok: true },
    { t: "Restart etcd with --encryption-provider=aescbc", ok: false }
  ],
  explain: "etcd does not do this encryption. Encryption applies on write, so existing objects keep their old form until they are rewritten - the step people forget."
},
{
  id: "q-ms-7", domain: "microservices", type: "single", difficulty: "hard",
  tags: ["encryption", "verification"],
  q: "How do you prove a Secret is really encrypted in etcd?",
  options: [
    { t: "Read the key with etcdctl (for example /registry/secrets/NAMESPACE/NAME) and look for the provider prefix in the value", ok: true },
    { t: "kubectl get secret -o yaml and check the data field", ok: false },
    { t: "kubectl get --raw /api/v1/secrets and check the Content-Type header", ok: false },
    { t: "kube-bench reports the CIS item for encryption", ok: false }
  ],
  explain: "kubectl always shows you the decrypted object because the API server decrypts on read. Only a direct etcd read proves the stored bytes are ciphertext."
},
{
  id: "q-ms-8", domain: "microservices", type: "single", difficulty: "hard",
  tags: ["encryption", "rotation"],
  q: "You must rotate the Secret encryption key with zero data loss. What is the correct order?",
  options: [
    { t: "Add the new key at the head of the keys list, keep the old key, restart the API server, then rewrite resources so they are re-encrypted, and only then remove the old key", ok: true },
    { t: "Delete the old key, restart the API server, then create new Secrets", ok: false },
    { t: "Replace the key value in place under the same key name", ok: false },
    { t: "Switch the provider to identity, then back to aescbc", ok: false }
  ],
  explain: "Objects encrypted under a key you removed become unreadable. New key first for writes, old key still present for reading, rewrite, then cleanup."
},
{
  id: "q-ms-9", domain: "microservices", type: "multi", difficulty: "medium",
  tags: ["multi-tenancy"],
  q: "Which layers are needed to make a namespace a real tenant boundary? (pick all that apply)",
  options: [
    { t: "RBAC scoped to the namespace, with no cluster-read permissions", ok: true },
    { t: "NetworkPolicy with default-deny ingress plus explicit cross-namespace allows", ok: true },
    { t: "ResourceQuota and LimitRange so one tenant cannot exhaust shared capacity", ok: true },
    { t: "Pod Security Standards enforced on the tenant namespace", ok: true },
    { t: "A separate Deployment per tenant inside the kube-system namespace", ok: false }
  ],
  explain: "Namespace alone is not a boundary: a Pod with cluster-read RBAC or a hostPath mount escapes it. Deploying tenant workloads into kube-system destroys the isolation."
},
{
  id: "q-ms-10", domain: "microservices", type: "single", difficulty: "medium",
  tags: ["runtimeclass"],
  q: "What does a RuntimeClass object actually do?",
  options: [
    { t: "It names a container runtime handler so a Pod that sets runtimeClassName runs with that runtime, and can restrict which namespaces and nodes may use it", ok: true },
    { t: "It sets seccomp and AppArmor profiles for the Pod", ok: false },
    { t: "It pins the container image digest used by the kubelet", ok: false },
    { t: "It selects which CNI plugin enforces the Pod's network policy", ok: false }
  ],
  explain: "RuntimeClass is CRI runtime selection (handler must exist in containerd/CRI-O config). allowed.namespaces and scheduling.nodeSelector are the scheduling/guard rails."
},
{
  id: "q-ms-11", domain: "microservices", type: "multi", difficulty: "medium",
  tags: ["sandbox", "gvisor", "kata"],
  q: "Which options run a container's workload outside the host kernel? (pick all that apply)",
  options: [
    { t: "gVisor (runsc): a user-space kernel that emulates the syscall surface", ok: true },
    { t: "Kata Containers: a lightweight VM with its own kernel per Pod", ok: true },
    { t: "runc with a seccomp RuntimeDefault profile", ok: false },
    { t: "A Pod running with privileged: false and drop ALL capabilities", ok: false }
  ],
  explain: "seccomp and capability dropping reduce what the container can ask the host kernel for, but the workload still runs in the host kernel. gVisor and Kata change that, which is why they are the 'isolation technique' answers."
},
{
  id: "q-ms-12", domain: "microservices", type: "single", difficulty: "hard",
  tags: ["istio", "mtls"],
  q: "In Istio, which resource makes the mesh refuse plaintext traffic to workloads in a namespace?",
  options: [
    { t: "PeerAuthentication with mtls.mode: STRICT", ok: true },
    { t: "DestinationRule with trafficPolicy.tls.mode: ISTIO_MUTUAL", ok: false },
    { t: "AuthorizationPolicy with action: DENY", ok: false },
    { t: "Gateway with mode: SIMPLE", ok: false }
  ],
  explain: "PeerAuthentication is the server-side enforcement; DestinationRule ISTIO_MUTUAL is the client side that presents a mesh certificate. You normally need both, but 'refuse plaintext' is PeerAuthentication."
},
{
  id: "q-ms-13", domain: "microservices", type: "single", difficulty: "hard",
  tags: ["secrets", "external"],
  q: "A task wants Secrets to never be stored in etcd. Which approach fits best?",
  options: [
    { t: "Mount the provider secret as an inline ephemeral CSI volume via a SecretProviderClass, keeping syncSecret disabled", ok: true },
    { t: "Encrypt Secrets at rest with aescbc", ok: false },
    { t: "Store the secret in a ConfigMap mounted read-only", ok: false },
    { t: "Use environment variables injected by the Deployment instead of Secrets", ok: false }
  ],
  explain: "CSI Secrets Store keeps the value out of the cluster data store entirely. Encryption at rest still stores the Secret; ConfigMaps are as readable as Secrets, and plain env values end up in the manifest."
},
{
  id: "q-ms-14", domain: "microservices", type: "single", difficulty: "medium",
  tags: ["cilium", "identity"],
  q: "Why is an identity-based network policy (Cilium) stronger than an IP-based one for pod-to-pod restriction?",
  options: [
    { t: "Policy is enforced on workload labels/identity, so it survives IP churn and cannot be bypassed by a Pod that reuses an address", ok: true },
    { t: "It encrypts the traffic between the two Pods automatically", ok: false },
    { t: "It removes the need for a CNI plugin", ok: false },
    { t: "It evaluates policy in the API server instead of the node", ok: false }
  ],
  explain: "Enforcement stays on the node/CNI. Cilium's advantage is identity-stable policy plus L7-aware rules; mTLS is a separate feature you must enable."
},

/* ---------------- Supply Chain Security (20%) ---------------- */
{
  id: "q-sc-1", domain: "supply-chain", type: "multi", difficulty: "medium",
  tags: ["base-image", "distroless"],
  q: "Which base image choices genuinely minimize the image footprint? (pick all that apply)",
  options: [
    { t: "gcr.io/distroless/static-nonroot for a static binary", ok: true },
    { t: "scratch plus your statically compiled binary and the CA certificate bundle", ok: true },
    { t: "A multi-stage build whose final stage copies only the built artifact", ok: true },
    { t: "python:3.12 slim plus pip install of the runtime and build dependencies", ok: false },
    { t: "ubuntu:latest so every distribution tool is available at runtime", ok: false }
  ],
  explain: "Build dependencies and package managers do not belong in the runtime image. :latest is also mutable, which breaks both traceability and reproducibility."
},
{
  id: "q-sc-2", domain: "supply-chain", type: "single", difficulty: "medium",
  tags: ["scratch", "tls"],
  q: "Your scratch-based image fails every HTTPS call with a certificate error. What is the fix?",
  options: [
    { t: "COPY the CA certificates from the build stage into the final image", ok: true },
    { t: "Set securityContext.allowPrivilegeEscalation: false", ok: false },
    { t: "Add a readiness probe over HTTPS", ok: false },
    { t: "Install ca-certificates in the final stage with apk", ok: false }
  ],
  explain: "scratch has no filesystem content at all - no CA bundle, no shell, no package manager. Installing at runtime is exactly what the minimal-footprint task forbids."
},
{
  id: "q-sc-3", domain: "supply-chain", type: "single", difficulty: "medium",
  tags: ["verify", "dockerfile"],
  q: "How do you show a reviewer that the compiler from stage 1 did not end up in the final image?",
  options: [
    { t: "docker history --no-trunc on the final image (and syft/trivy to list what is really inside)", ok: true },
    { t: "docker image inspect --format '{{.Config.Entrypoint}}'", ok: false },
    { t: "kubectl describe pod and read the container args", ok: false },
    { t: "The build log of stage 1", ok: false }
  ],
  explain: "Layer history plus an SBOM/scan is the evidence. Entrypoint and Pod args say nothing about image contents."
},
{
  id: "q-sc-4", domain: "supply-chain", type: "multi", difficulty: "medium",
  tags: ["sbom"],
  q: "Which items belong in an SBOM you keep as a build artifact? (pick all that apply)",
  options: [
    { t: "Component names, versions and their package-manager identifiers", ok: true },
    { t: "Digests or hashes that tie each component to what was actually shipped", ok: true },
    { t: "The relationship between the image and the components it contains", ok: true },
    { t: "The runtime seccomp syscall allowlist", ok: false }
  ],
  explain: "An SBOM describes composition, not runtime confinement. It is what you diff when a new CVE appears."
},
{
  id: "q-sc-5", domain: "supply-chain", type: "single", difficulty: "hard",
  tags: ["cosign", "keyless"],
  q: "Verifying a keylessly signed image with recent cosign versions requires what?",
  options: [
    { t: "--certificate-identity (or --certificate-identity-regexp) and --certificate-oidc-issuer", ok: true },
    { t: "--key cosign.pub only", ok: false },
    { t: "--annotations only", ok: false },
    { t: "Nothing: cosign verifies any valid signature it can find", ok: false }
  ],
  explain: "Keyless verification without an identity constraint accepts a signature from any identity - so modern cosign refuses to verify unless you state which issuer and identity are trusted."
},
{
  id: "q-sc-6", domain: "supply-chain", type: "single", difficulty: "hard",
  tags: ["cosign", "digest"],
  q: "What should you sign: the tag or the digest?",
  options: [
    { t: "The digest - a tag is a mutable alias and a signature attached to it can be moved", ok: true },
    { t: "The tag, because admission policies match on tags", ok: false },
    { t: "Both, and admission should verify the tag", ok: false },
    { t: "Neither: the registry signature is enough", ok: false }
  ],
  explain: "Registry-issued signatures are not content signatures. Sign the immutable reference and verify the image by digest at admission."
},
{
  id: "q-sc-7", domain: "supply-chain", type: "multi", difficulty: "medium",
  tags: ["admission", "verifyimages"],
  q: "Which mechanisms can block an unsigned image from being scheduled? (pick all that apply)",
  options: [
    { t: "A Kyverno ClusterPolicy with a verifyImages rule in Enforce mode", ok: true },
    { t: "ImagePolicyWebhook admission plugin pointed at a policy service", ok: true },
    { t: "PodSecurity 'restricted' namespace labels", ok: false },
    { t: "NodeRestriction admission plugin", ok: false }
  ],
  explain: "PSA constrains Pod fields, not image provenance. NodeRestriction constrains kubelets. Signature verification needs an image-aware admission check."
},
{
  id: "q-sc-8", domain: "supply-chain", type: "single", difficulty: "medium",
  tags: ["digest", "manifest"],
  q: "Which manifest line makes the deployed container identity reproducible?",
  options: [
    { t: "image: registry.internal.local/org/api@sha256:<digest> with imagePullPolicy: IfNotPresent", ok: true },
    { t: "image: registry.internal.local/org/api:latest with imagePullPolicy: Always", ok: false },
    { t: "image: registry.internal.local/org/api:v1 with imagePullPolicy: Always", ok: false },
    { t: "imagePullPolicy: Always plus a tag and an imagePullSecrets entry", ok: false }
  ],
  explain: "A digest reference fixes the exact bytes; the effective pull policy for a digest reference is IfNotPresent (Always with a digest is rejected). A tag plus Always gives a different image whenever the tag moves."
},
{
  id: "q-sc-9", domain: "supply-chain", type: "single", difficulty: "medium",
  tags: ["trivy", "ci"],
  q: "Which tool and flag combination fails a CI job on unfixed HIGH/CRITICAL CVEs in an image?",
  options: [
    { t: "trivy image --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed <image>", ok: true },
    { t: "kubesec scan image.tar", ok: false },
    { t: "kubelinter lint image.tar", ok: false },
    { t: "conftest test --policy policy/ <image>", ok: false }
  ],
  explain: "KubeLinter, Kubesec and Conftest look at manifests, not image CVEs. --ignore-unfixed is a deliberate tradeoff: it says 'block only what I can patch' - state that in an answer."
},
{
  id: "q-sc-10", domain: "supply-chain", type: "multi", difficulty: "medium",
  tags: ["static-analysis"],
  q: "Which tool-to-target mappings are correct? (pick all that apply)",
  options: [
    { t: "KubeLinter - lint Kubernetes manifests for correctness and security checks", ok: true },
    { t: "Kubesec - risk score for a workload manifest (privileged, hostPath, capability grants)", ok: true },
    { t: "Conftest - your own Rego rules applied to manifests", ok: true },
    { t: "kube-bench - static analysis of your Deployment YAML before deploy", ok: false },
    { t: "syft - CVE database lookups for running Pods", ok: false }
  ],
  explain: "kube-bench audits a live cluster against CIS checks, not your manifest files. syft produces an SBOM; the CVE matching is done by a scanner such as Grype or Trivy."
},
{
  id: "q-sc-11", domain: "supply-chain", type: "single", difficulty: "hard",
  tags: ["registry", "pull-secret"],
  q: "Every Pod in a namespace must be able to pull from a private registry, without editing each workload. What do you do?",
  options: [
    { t: "Create a docker-registry Secret and patch the namespace's default ServiceAccount with imagePullSecrets", ok: true },
    { t: "Add imagePullSecrets to every Deployment manifest", ok: false },
    { t: "Store the registry password in the Pod's env from a Secret", ok: false },
    { t: "Open the registry to anonymous pulls for the cluster's egress IP", ok: false }
  ],
  explain: "ServiceAccount-level imagePullSecrets is the maintainable answer - but note that a Pod specifying its own imagePullSecrets list overrides it."
},
{
  id: "q-sc-12", domain: "supply-chain", type: "single", difficulty: "hard",
  tags: ["registry", "bypass"],
  q: "You wrote a policy allowing only your internal registry for containers. Which gap should you close next?",
  options: [
    { t: "initContainers, ephemeralContainers (kubectl debug) and sidecar/extra containers used by controllers", ok: true },
    { t: "ConfigMap keys referencing image names", ok: false },
    { t: "Ingress hosts pointing at external registries", ok: false },
    { t: "The imagePullPolicy value on the Pod", ok: false }
  ],
  explain: "Image fields live in several places, including the ephemeral debug containers a rescuer creates mid-incident. A policy that checks only spec.containers is trivially bypassed."
},
{
  id: "q-sc-13", domain: "supply-chain", type: "single", difficulty: "medium",
  tags: ["supply-chain", "pipeline"],
  q: "In a supply-chain question, what does 'reproducible deployment' require you to state?",
  options: [
    { t: "One build per commit, an immutable digest reference in the manifest, and the SBOM/signature artifacts kept next to that digest", ok: true },
    { t: "A pinned :latest tag plus a documented release calendar", ok: false },
    { t: "Deploying from the same CI runner image every time", ok: false },
    { t: "Signing the manifest YAML with GPG", ok: false }
  ],
  explain: "Reproducibility is about identity: same source commit, same image bytes, same verified artifact, deployed by digest - so a rebuild from the same commit yields the same running image."
},
{
  id: "q-sc-14", domain: "supply-chain", type: "multi", difficulty: "hard",
  tags: ["provenance", "attestation"],
  q: "Which statements about build provenance and attestations are correct? (pick all that apply)",
  options: [
    { t: "Provenance records who built the artifact, from which source and in which pipeline", ok: true },
    { t: "Attestations are attached to the image in the registry as OCI artifacts, so a plain image copy loses them unless you copy them too", ok: true },
    { t: "Admission can require an attestation before an image may run", ok: true },
    { t: "An attestation is only valid if it is signed by the cluster's own CA", ok: false }
  ],
  explain: "Attestations are signed by the build identity (Sigstore/Fulcio style), not by the cluster CA. Registry moves need cosign copy or equivalent to carry signatures and attestations along."
},

/* ---------------- Monitoring, Logging and Runtime Security (20%) ---------------- */
{
  id: "q-rt-1", domain: "runtime-security", type: "single", difficulty: "medium",
  tags: ["falco", "driver"],
  q: "On a lab cluster whose nodes lack kernel headers and a module toolchain, which Falco collector do you choose?",
  options: [
    { t: "The modern eBPF probe driver (driver.kind: modern_ebpf)", ok: true },
    { t: "The kernel module driver, built by the falco-driver-loader init container", ok: false },
    { t: "Userspace polling only, because eBPF needs kernel headers too", ok: false },
    { t: "Falco cannot run without a kernel module", ok: false }
  ],
  explain: "The modern eBPF probe is the practical choice: no DKMS, no kernel headers, and it works on kind/Docker Desktop nodes where the module build usually fails."
},
{
  id: "q-rt-2", domain: "runtime-security", type: "single", difficulty: "medium",
  tags: ["falco", "rules"],
  q: "You added a custom rule and the Falco Pod is crashlooping. What should you do before anything else?",
  options: [
    { t: "Validate the rule file inside the Falco Pod (falco --validate <file>, and check --help for your version's flag)", ok: true },
    { t: "Increase the DaemonSet memory limit", ok: false },
    { t: "Switch the driver to the kernel module", ok: false },
    { t: "Delete the custom rule and rely on the default ruleset", ok: false }
  ],
  explain: "A bad condition, an unknown macro or a wrong field name fails rule loading. Validation gives you the file and line; the crashloop alone tells you nothing."
},
{
  id: "q-rt-3", domain: "runtime-security", type: "multi", difficulty: "medium",
  tags: ["falco", "fields"],
  q: "Which Falco fields are available in a rule output when Kubernetes metadata collection is enabled? (pick all that apply)",
  options: [
    { t: "k8s.pod.name and k8s.ns.name", ok: true },
    { t: "container.image.repository and container.image.tag", ok: true },
    { t: "proc.cmdline, proc.pname and proc.pcmdline", ok: true },
    { t: "pod.spec.privileged", ok: false }
  ],
  explain: "Falco's fields come from syscall events plus enrichment (process, container, Kubernetes metadata). Pod spec fields are not Falco fields - read those with kubectl."
},
{
  id: "q-rt-4", domain: "runtime-security", type: "multi", difficulty: "medium",
  tags: ["falco", "tuning"],
  q: "A lab cluster floods you with alerts from shipped rules. What are legitimate tuning moves? (pick all that apply)",
  options: [
    { t: "Put overrides in falco_rules.local.yaml / custom_rules instead of editing falco_rules.yaml", ok: true },
    { t: "Scope a rule with a macro or list you define (for example only your application images)", ok: true },
    { t: "Disable or re-scope the noisy shipped rule with an override", ok: true },
    { t: "Set the Falco priority of every rule to EMERGENCY so everything is visible", ok: false },
    { t: "Turn off the collector so no events are captured", ok: false }
  ],
  explain: "Tuning means 'right signal, right scope'. Priority inflation and disabling collection both destroy detection coverage."
},
{
  id: "q-rt-5", domain: "runtime-security", type: "single", difficulty: "medium",
  tags: ["audit", "levels"],
  q: "Which audit policy level records the request body and the response body?",
  options: [
    { t: "RequestResponse", ok: true },
    { t: "Request", ok: false },
    { t: "Metadata", ok: false },
    { t: "None", ok: false }
  ],
  explain: "Metadata gives identity/verb/resource only. Request gives the request object. RequestResponse gives both - the level you want for secrets access, pods/exec and RBAC changes."
},
{
  id: "q-rt-6", domain: "runtime-security", type: "single", difficulty: "hard",
  tags: ["audit", "policy"],
  q: "Your audit policy has a broad Metadata catch-all rule first and a RequestResponse rule for secrets second. What do you observe?",
  options: [
    { t: "Secret requests are logged at Metadata level, because the first matching rule wins", ok: true },
    { t: "Secret requests are logged at RequestResponse level because the narrower rule is more specific", ok: false },
    { t: "Both rules apply and the event is duplicated", ok: false },
    { t: "The API server rejects the policy file", ok: false }
  ],
  explain: "Audit policy evaluation is ordered, first-match. High-value narrow rules go first, the catch-all last."
},
{
  id: "q-rt-7", domain: "runtime-security", type: "multi", difficulty: "medium",
  tags: ["audit", "attribution"],
  q: "Which audit event fields let you attribute an action to a real actor? (pick all that apply)",
  options: [
    { t: "user.username and user.groups", ok: true },
    { t: "sourceIPs", ok: true },
    { t: "objectRef (resource, subresource, namespace, name) and verb", ok: true },
    { t: "requestReceivedTimestamp and stage", ok: true },
    { t: "container.id", ok: false }
  ],
  explain: "Audit events are API-level records; there is no container.id in them. Impersonation shows up in the user info's extra fields."
},
{
  id: "q-rt-8", domain: "runtime-security", type: "single", difficulty: "hard",
  tags: ["audit", "jq"],
  q: "You must list who created Pods and in which namespaces from the audit log. Which pipeline is correct?",
  options: [
    { t: "jq -c 'select(.verb==\"create\" and .objectRef.resource==\"pods\") | {user:.user.username, ns:.objectRef.namespace, name:.objectRef.name}' on the audit log file", ok: true },
    { t: "kubectl get events -A -o json | jq '.items[].reason'", ok: false },
    { t: "kubectl get pods -A -o json | jq '.items[].metadata.managedFields'", ok: false },
    { t: "journalctl -u kubelet | grep created", ok: false }
  ],
  explain: "managedFields records last manager per field but not a full history, and events are short-lived and incomplete. The API audit log is the authoritative who-did-what source."
},
{
  id: "q-rt-9", domain: "runtime-security", type: "single", difficulty: "medium",
  tags: ["audit", "who-exec"],
  q: "A task asks: 'Who ran a shell inside this Pod, and when?' Which log answers it?",
  options: [
    { t: "The Kubernetes API audit log, filtered on objectRef.subresource == \"exec\"", ok: true },
    { t: "The kubelet log on the node", ok: false },
    { t: "kubectl get events for that namespace", ok: false },
    { t: "The container's stdout", ok: false }
  ],
  explain: "pods/exec is an API request, so it is in the audit log. Falco tells you what the process did inside the container, which is the complement - usually you need both."
},
{
  id: "q-rt-10", domain: "runtime-security", type: "multi", difficulty: "medium",
  tags: ["detection", "sensors"],
  q: "Which pairings of plane and sensor are correct? (pick all that apply)",
  options: [
    { t: "Workload/process behaviour -> Falco syscall rules", ok: true },
    { t: "API and user activity -> Kubernetes audit log (or Falco k8saudit rules)", ok: true },
    { t: "Network flows between workloads -> CNI flow visibility such as Hubble, plus policy deny metrics", ok: true },
    { t: "Node filesystem and process changes on the host -> auditd watch rules", ok: true },
    { t: "Container image CVE presence -> kubelet event stream", ok: false }
  ],
  explain: "kubelet events report scheduling/lifecycle problems, not vulnerabilities. Image CVE presence is a scanner answer (Trivy/Grype), ideally with an SBOM."
},
{
  id: "q-rt-11", domain: "runtime-security", type: "multi", difficulty: "hard",
  tags: ["incident", "containment"],
  q: "You have identified a compromised Deployment actively exfiltrating data. Which containment steps preserve your ability to investigate? (pick all that apply)",
  options: [
    { t: "Apply an egress-deny NetworkPolicy (with kube-dns allowed) scoped to the workload", ok: true },
    { t: "Scale the workload to zero and copy logs/files out first", ok: true },
    { t: "Cordon the node, and drain it only after evidence is captured", ok: true },
    { t: "Delete the Pods immediately so the attacker loses access", ok: false },
    { t: "Delete the Deployment and its Service to remove the entry point", ok: false }
  ],
  explain: "Deleting first destroys evidence and does not remove persistence - a CronJob, DaemonSet or mutating webhook re-creates the workload. Cut the network, capture, then remove the controller and its source of privilege."
},
{
  id: "q-rt-12", domain: "runtime-security", type: "single", difficulty: "hard",
  tags: ["incident", "persistence"],
  q: "After you delete a compromised Pod it reappears within minutes. What should you look for first?",
  options: [
    { t: "A controller that re-creates it (Deployment/DaemonSet/CronJob) plus any new RBAC binding or webhook that re-establishes access", ok: true },
    { t: "The kubelet's Pod garbage collector", ok: false },
    { t: "A stale ReplicaSet hash collision", ok: false },
    { t: "ClusterDNS caching the old Pod name", ok: false }
  ],
  explain: "Reappearance means an owner object still exists. Real persistence in Kubernetes looks like: an owning workload, a new Role/ClusterRoleBinding, a SA token Secret, a static Pod on a node, or a new admission webhook."
},
{
  id: "q-rt-13", domain: "runtime-security", type: "single", difficulty: "medium",
  tags: ["forensics", "node"],
  q: "You cannot SSH to a node but must inspect its running processes and network connections. What is the fastest supported route?",
  options: [
    { t: "kubectl debug node/<node> -it --image=busybox:1.36 -- chroot /host sh", ok: true },
    { t: "kubectl exec into the compromised Pod and run ps", ok: false },
    { t: "kubectl logs <node> --previous", ok: false },
    { t: "kubectl get --raw /api/v1/nodes/<node>/proxy", ok: false }
  ],
  explain: "The node debug Pod runs a privileged ephemeral container in the host namespace and chroots into the host filesystem. A Pod cannot see host processes unless it already has hostPID."
},
{
  id: "q-rt-14", domain: "runtime-security", type: "multi", difficulty: "medium",
  tags: ["immutability"],
  q: "Which settings enforce immutability of a container at runtime? (pick all that apply)",
  options: [
    { t: "readOnlyRootFilesystem: true plus explicit emptyDir mounts for the paths the app must write", ok: true },
    { t: "Image referenced by digest with imagePullPolicy: IfNotPresent", ok: true },
    { t: "capabilities.drop: [\"ALL\"], allowPrivilegeEscalation: false, runAsNonRoot with a numeric UID", ok: true },
    { t: "A shell in the image so operators can patch the running container during an incident", ok: false },
    { t: "imagePullPolicy: Always on a digest reference", ok: false }
  ],
  explain: "A writable root plus a shell is how in-place tampering and dropped binaries happen. Always on a digest reference is rejected by the API server."
},
{
  id: "q-rt-15", domain: "runtime-security", type: "single", difficulty: "easy",
  tags: ["immutability", "readonly"],
  q: "You set readOnlyRootFilesystem: true and the app crashes writing its temp files. What is the right fix?",
  options: [
    { t: "Mount an emptyDir volume at the exact path the app writes to (for example /tmp)", ok: true },
    { t: "Remove readOnlyRootFilesystem", ok: false },
    { t: "Mount a hostPath volume at / and make it writable", ok: false },
    { t: "Run the container as root so the write succeeds", ok: false }
  ],
  explain: "Immutable root plus narrow, ephemeral writable mounts is the pattern. A writable hostPath at / reintroduces the escape the control was meant to prevent."
},
{
  id: "q-rt-16", domain: "runtime-security", type: "single", difficulty: "medium",
  tags: ["incident", "token"],
  q: "A legacy ServiceAccount token Secret has been read by an attacker. What revokes it?",
  options: [
    { t: "Delete that token Secret (and rotate anything that used it); bound projected tokens expire on their own", ok: true },
    { t: "Delete the ServiceAccount only - the token becomes invalid automatically", ok: false },
    { t: "Set automountServiceAccountToken: false on the ServiceAccount", ok: false },
    { t: "Restart the API server", ok: false }
  ],
  explain: "kubernetes.io/service-account-token Secrets are long-lived until deleted. automountServiceAccountToken stops new mounts; it does not revoke an already leaked token."
}
];
