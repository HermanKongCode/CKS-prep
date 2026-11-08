/* CKS Prep - per-option rationales, Minimize Microservice Vulnerabilities. Shown only after the learner submits an answer. */
window.CKS_QUIZ_WHY_4 = {
  "q-ms-1": [
    "restricted includes the no-privilege-escalation policy, which forces allowPrivilegeEscalation: false on every container.",
    "restricted enforces runAsNonRoot or a non-zero runAsUser so the container process cannot start as UID 0.",
    "restricted sets the seccomp type to RuntimeDefault or Localhost, checked at Pod level and for each container.",
    "restricted requires capabilities drop ALL and allows only explicitly listed capabilities back, such as NET_BIND_SERVICE.",
    "readOnlyRootFilesystem is not evaluated by any PodSecurity policy, so it is good practice but not a level requirement."
  ],
  "q-ms-2": [
    "The PodSecurity admission plugin reads pod-security.kubernetes.io/enforce and rejects a request whose Pod fails that level.",
    "The audit label records a warning Event on the namespace for each non-compliant request while still admitting the Pod.",
    "The warn label attaches a warning to the kubectl response, so violations are visible to the user but nothing is blocked.",
    "pod-security.kubernetes.io/mode is not a recognised label key, so nothing is enforced and non-compliant Pods are admitted."
  ],
  "q-ms-3": [
    "PodSecurityPolicy was removed in v1.25, so no API version is served for it; PSA labels or a policy engine replace it.",
    "Naming PodSecurityPolicy in --enable-admission-plugins makes kube-apiserver fail to start because that plugin no longer exists.",
    "A NetworkPolicy only describes pod network flows; it cannot carry runAsUser, capability or volume rules from the old policy.",
    "kube-system is already exempt from PodSecurity enforcement through the built-in exemptions, so no removed object needs keeping."
  ],
  "q-ms-4": [
    "Kyverno policies are custom resources you apply with kubectl, written in YAML using match, validate and mutate blocks.",
    "Gatekeeper runs Rego logic installed as a ConstraintTemplate CRD, with each Constraint instance supplying parameters to it.",
    "Both are validating admission webhooks, so failurePolicy and namespace exclusions decide whether an outage blocks workload creation.",
    "Rego is the language of OPA Gatekeeper, while Kyverno policies are YAML rules that use its own pattern syntax."
  ],
  "q-ms-5": [
    "--dry-run=server sends the object through the real admission chain, so a validating policy denial surfaces without persisting anything.",
    "--dry-run=client only checks the manifest against local schema and openapi data, so no webhook runs and no policy verdict appears.",
    "--validate=false skips client-side openapi checks and still creates the object, leaving the bad Deployment live in the cluster.",
    "kubectl diff is built to compare live state with the manifest, so an admission denial is buried in diff output rather than reported."
  ],
  "q-ms-6": [
    "The first provider entry in EncryptionConfiguration encrypts new writes, so aescbc leads and identity trails as the fallback.",
    "On a kubeadm node the flag is added to /etc/kubernetes/manifests/kube-apiserver.yaml, which kubelet reloads as a static Pod.",
    "A hostPath mount plus the flag path is required, since the API server container cannot read a file that is not mounted into it.",
    "Encryption is applied only on write, so a read-modify-write pass over existing Secrets is what actually re-encrypts them.",
    "etcd has no encryption-provider flag at all, because kube-apiserver encrypts each value before it is written into etcd."
  ],
  "q-ms-7": [
    "etcdctl get on the /registry/secrets/NAMESPACE/NAME key shows stored bytes prefixed with the provider marker, such as k8s:enc:aescbc:v1.",
    "kubectl always shows the decrypted object because the API server decrypts on read, so the data field says nothing about etcd.",
    "kubectl get --raw still passes through the API server layer, which decrypts before serialising, so ciphertext is never returned.",
    "kube-bench inspects the API server process flags for --encryption-provider-config, not the bytes actually stored in etcd."
  ],
  "q-ms-8": [
    "Putting the new key first encrypts new writes with it while the old key stays listed, so old objects remain readable until rewritten.",
    "Removing the old key before rewriting makes every Secret stored under it undecodable, breaking live workloads at read time.",
    "Editing the secret value in place leaves existing ciphertext bound to the material it was made with, so those objects fail to decode.",
    "Switching to identity writes plaintext during that window and only re-encrypts what is touched after switching back to aescbc."
  ],
  "q-ms-9": [
    "Role plus RoleBinding inside the tenant namespace limits its principals, while any ClusterRoleBinding would grant cluster-wide reads.",
    "Default-deny ingress plus explicit namespaceSelector and podSelector allows is what stops other namespaces reaching tenant Pods.",
    "ResourceQuota caps total namespace consumption and LimitRange sets per-container defaults, protecting shared capacity from one tenant.",
    "Enforcing restricted on the namespace blocks privileged Pods, hostPath, hostNetwork and hostPID, which are the escapes out of a namespace.",
    "Putting tenant workloads in kube-system places them in a namespace exempt from PodSecurity enforcement and mixed with system components."
  ],
  "q-ms-10": [
    "RuntimeClass maps runtimeClassName to a handler defined in containerd or CRI-O, with allowed namespaces and nodeSelector as guard rails.",
    "RuntimeClass selects a CRI runtime handler; seccomp and AppArmor profiles come from securityContext, which it does not modify.",
    "Image digest pinning is a property of the image field in the container spec; RuntimeClass has no field that references an image.",
    "The CNI plugin is fixed per cluster by its own config and agents, so RuntimeClass only routes a Pod to a runtime handler."
  ],
  "q-ms-11": [
    "gVisor runsc services syscalls in a user-space kernel, so the workload never issues syscalls directly against the host kernel.",
    "Kata Containers boots a lightweight VM with its own guest kernel per Pod, so a container escape lands inside that VM, not on the host.",
    "A seccomp profile filters which syscalls are permitted, but permitted ones still execute in the host kernel on behalf of the process.",
    "Dropping ALL capabilities limits privileged operations, yet the container still shares the host kernel exactly as runc always does."
  ],
  "q-ms-12": [
    "PeerAuthentication with mode STRICT makes the server-side sidecar require mTLS and reject plaintext connections to workloads in its scope.",
    "DestinationRule trafficPolicy.tls.mode ISTIO_MUTUAL configures the client sidecar to present mesh certificates, not the server refusal.",
    "AuthorizationPolicy DENY blocks requests matching its rules but performs no TLS negotiation, so plaintext itself is still accepted.",
    "A Gateway with mode SIMPLE terminates TLS at the edge and forwards plaintext to the backend, which does not restrict mesh traffic."
  ],
  "q-ms-13": [
    "An inline ephemeral CSI volume from a SecretProviderClass puts the provider value in the Pod without creating a Secret object in etcd.",
    "aescbc only changes how the Secret is stored, since the Secret object and its data still live in etcd as ciphertext.",
    "ConfigMap values are stored and read like Secret data and are not marked sensitive, so this keeps the value in etcd regardless.",
    "Environment values still require a Secret to avoid plaintext manifests, and both are readable through the workload spec."
  ],
  "q-ms-14": [
    "Cilium assigns each Endpoint a security identity derived from its labels, so policy keys on identity instead of a reusable address.",
    "Network policy only decides which flows are allowed; encrypting those flows is a separate mesh or IPsec feature you must enable.",
    "Cilium is itself a CNI, and its policies are enforced by agent eBPF programs on nodes, so no CNI layer disappears here.",
    "The API server only stores and admits the CiliumNetworkPolicy object; each flow verdict is still taken on the node datapath."
  ]
};
