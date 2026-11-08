/*
 * CKS Prep - study content, part 2.
 * Domains: Minimize Microservice Vulnerabilities (20%), Supply Chain Security (20%),
 *          Monitoring, Logging and Runtime Security (20%).
 */

window.CKS_LEARN.push(

/* ---------------------------------------- Minimize Microservice Vulnerabilities */

{
  id: "ms-psa",
  domain: "microservices",
  title: "Pod Security Standards and the PodSecurity admission controller",
  tags: ["psa", "podsecurity", "baseline", "restricted"],
  summary:
    "Three levels (privileged, baseline, restricted) enforced per namespace by labels. PodSecurity replaces PodSecurityPolicy - PSP is gone from modern clusters, so never write one.",
  notes: [
    "Namespace labels drive it: pod-security.kubernetes.io/enforce, /audit, /warn (each privileged|baseline|restricted) plus -version variants to pin the standard version. enforce rejects, audit and warn only log/return warnings to kubectl.",
    "baseline blocks the well-known privilege escalations: privileged containers, privilege escalation (allowPrivilegeEscalation and elevated capabilities), hostPath volumes, host namespaces (hostNetwork including hostPorts, hostPID, hostIPC), projected volumes that reach /proc, /sys or /dev, SELinux options, and Windows hostProcess pods.",
    "restricted adds the compliance half: runAsNonRoot (or non-zero runAsUser), allowPrivilegeEscalation=false, no privileged capabilities (drop ALL, may add only from the allowed list, CAP_NET_BIND_SERVICE needs the drop-ALL pattern), seccompProfile RuntimeDefault or Localhost.",
    "Enforcement is namespaced and does not apply to Pods that already exist until they are recreated - plan for 'audit first, warn users, then enforce' in a live cluster.",
    "Existing workloads that fail restricted are the exam's favourite: you must fix the Pod (or its Deployment) so it passes, not weaken the namespace.",
    "Admission order: PodSecurity runs as an admission plugin; if you ever override --enable-admission-plugins you must list PodSecurity explicitly or enforcement silently stops."
  ],
  commands: [
    { cmd: "kubectl label namespace prod pod-security.kubernetes.io/enforce=baseline pod-security.kubernetes.io/audit=restricted pod-security.kubernetes.io/warn=restricted --overwrite", why: "The core action of a PSA task - one command, verifiable by the grader." },
    { cmd: "kubectl get ns prod -o jsonpath='{.metadata.labels}' | tr ',' '\\n'", why: "Confirm the labels actually landed." },
    { cmd: "kubectl run test --image=busybox:1.36 -n prod --privileged -- sleep 3600", why: "Prove enforcement: you expect 'admission webhook \"PodSecurity\" denied the request' quoting the exact violated check." },
    { cmd: "kubectl apply -f broken-pod.yaml -n prod --dry-run=server 2>&1 | head -20", why: "Test a fix without leaving a Pod behind; the denial message tells you which field to fix." },
    { cmd: "kubectl get pods -A -o json | jq -r '.items[] | select(.spec.securityContext?.privileged==true or (.spec.hostNetwork==true)) | .metadata.namespace+\"/\"+.metadata.name'", why: "Find the non-compliant Pods before you flip a namespace to enforce." },
    { cmd: "kubectl get events -n prod --sort-by=.lastTimestamp | grep -i podsecurity | tail -20", why: "Audit-level violations show up as warning events - use them to enumerate what will break." },
    { cmd: "kubectl delete ns prod --wait=false  # kubectl label ns prod pod-security.kubernetes.io/enforce-  to remove enforcement", why: "Removing a label with the trailing dash is the documented way to undo it." }
  ],
  yaml: [
    {
      title: "A Pod that passes the restricted standard",
      body: `apiVersion: v1
kind: Pod
metadata: { name: api, namespace: prod, labels: { app: api } }
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    fsGroup: 10001
    seccompProfile: { type: RuntimeDefault }
  containers:
  - name: app
    image: gcr.io/distroless/static-nonroot
    securityContext:
      privileged: false
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
    volumeMounts:
    - { name: tmp, mountPath: /tmp }
  volumes:
  - { name: tmp, emptyDir: {} }`
    },
    {
      title: "Namespace pinned to restricted with versioned standards",
      body: `apiVersion: v1
kind: Namespace
metadata:
  name: prod
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted`
    }
  ],
  gotchas: [
    "PodSecurityPolicy was removed in v1.25. If you write a PSP, you score zero - the modern answers are PodSecurity/PSA labels, Kyverno or OPA Gatekeeper.",
    "runAsNonRoot: true plus an image whose /etc/passwd has no matching UID and whose USER is a name makes the kubelet refuse to start the Pod ('container has runAsNonRoot and image will run as root'). Set numeric runAsUser or fix the image.",
    "Adding a capability without dropping ALL first still fails restricted. The pattern is drop ALL, then add only an allowed capability.",
    "A Deployment under an enforcing namespace validates its Pod template, not the Deployment object's own securityContext - put the fields in the template."
  ],
  docs: [
    { label: "Pod Security Standards (full requirement tables)", url: "https://kubernetes.io/docs/concepts/security/pod-security-standards/" },
    { label: "PodSecurity admission + namespace labels", url: "https://kubernetes.io/docs/concepts/security/pod-security-admission/" }
  ]
},

{
  id: "ms-policy",
  domain: "microservices",
  title: "Policy engines: Kyverno (and OPA Gatekeeper) for real-world rules",
  tags: ["kyverno", "opa", "gatekeeper", "admission"],
  summary:
    "PSA covers Pods only. For 'no :latest images', 'every Pod needs a label', 'one ingress per host', 'disallow hostPath' you need a policy engine, and you must know how to test it.",
  notes: [
    "Kyverno is Kubernetes-native YAML: ClusterPolicy (cluster) and Policy (namespaced), rules with match/validate, and validationFailureAction: Enforce|Audit.",
    "Kyverno match supports imageReferences, annotations, labels, namespaceSelector, and exclude blocks - a precise rule is the difference between a working policy and a cluster-wide outage.",
    "Test policies without breaking the cluster: kubectl apply --dry-run=server, and the kyverno CLI (kyverno apply policy.yaml --resource pod.yaml).",
    "Kyverno also muts (mutate rules), generates resources (auto-create a NetworkPolicy per namespace), validates images (verifyImages) and has podSecurityChecks for standard checks.",
    "OPA Gatekeeper uses a ConstraintTemplate (Rego) + Constraint CRD instances; powerful but heavier - know the concept and how to enforce a Constraint.",
    "Webhook failure policy matters: a policy webhook that is unreachable with failurePolicy: Fail blocks the whole cluster. Kyverno's failures are visible in the deny message; verify before you flip to Enforce."
  ],
  commands: [
    { cmd: "helm repo add kyverno https://kyverno.github.io/kyverno/ && helm repo update && helm install kyverno kyverno/kyverno -n kyverno --create-namespace", why: "Install the engine a policy task assumes is present." },
    { cmd: "kubectl get clusterpolicy -o custom-columns=NAME:.metadata.name,ACTION:.spec.validationFailureAction,READY:.status.conditions[0].status", why: "Quick policy inventory with enforcement mode." },
    { cmd: "kubectl apply -f disallow-privileged.yaml --dry-run=server && kubectl run bad --image=busybox --privileged -n prod -- sleep 60", why: "Prove the policy denies - the deny message names the rule." },
    { cmd: "kyverno apply policy.yaml --resource broken-pod.yaml", why: "Local CLI test: run the policy against manifests before touching the cluster." },
    { cmd: "kubectl logs -n kyverno deploy/kyverno-admission-controller | grep -i 'validation rule' | tail -20", why: "Audit-mode violations are logged here - your evidence trail." },
    { cmd: "kubectl get policyreport,clusterpolicyreport -A -o wide | head", why: "Background scans produce reports of existing violations - graders love this." }
  ],
  yaml: [
    {
      title: "Kyverno: disallow privileged + force a security baseline",
      body: `apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: pod-security-baseline }
spec:
  validationFailureAction: Enforce
  background: true
  rules:
  - name: privileged-containers
    match:
      any:
      - resources:
          kinds: [Pod]
    validate:
      message: "Privileged containers are not allowed."
      pattern:
        spec:
          containers:
          - =(securityContext):
              =(privileged): "false"
  - name: require-drop-all
    match:
      any:
      - resources:
          kinds: [Pod]
    validate:
      message: "All capabilities must be dropped."
      pattern:
        spec:
          containers:
          - securityContext:
              capabilities:
                drop: ["ALL"]`
    },
    {
      title: "Kyverno: no :latest tags, only approved registries",
      body: `apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: image-registry-allowlist }
spec:
  validationFailureAction: Enforce
  rules:
  - name: approved-registry
    match:
      any:
      - resources:
          kinds: [Pod, Deployment, StatefulSet, DaemonSet, Job, CronJob]
    exclude:
      any:
      - resources:
          namespaces: ["kube-system", "kyverno", "falco"]
    validate:
      message: "Images must come from registry.internal.local and must not use :latest."
      pattern:
        spec:
          template:
            spec:
              containers:
              - image: "registry.internal.local/**"
  - name: no-latest-tag
    match:
      any:
      - resources:
          kinds: [Pod]
    validate:
      message: "Image tag :latest is not allowed."
      pattern:
        spec:
          containers:
          - image: "!*:latest"`
    }
  ],
  gotchas: [
    "Kyverno pattern syntax, learned once, saves the whole task: '*' matches any run of characters, '?' matches exactly one, '!pattern' negates, and '=(key)' is a conditional anchor (the key may be absent, but if it is present it must match). 'registry.internal.local/**' matches that host only - a leading '*' matches everything.",
    "One pattern string cannot OR two registries. If debug images need a different allowance, write a second rule for ephemeralContainers rather than jamming both into one pattern.",
    "A ClusterPolicy with match on Pod will also evaluate Pods created by Deployments/DaemonSets - that is intended; a namespaced Policy will not see other namespaces.",
    "Kyverno exclusion of kube-system is not cosmetic: Falco/CNI/DNS components genuinely need elevated permissions and will crashloop without it.",
    "OPA/Gatekeeper and Kyverno should not both enforce the same check in Enforce mode - pick one and say why."
  ],
  docs: [
    { label: "Kyverno policy library (copy-paste-ready policies)", url: "https://kyverno.io/policies/" },
    { label: "OPA Gatekeeper overview", url: "https://open-policy-agent.github.io/gatekeeper/website/docs/" }
  ]
},

{
  id: "ms-secrets",
  domain: "microservices",
  title: "Secrets: encryption at rest and least-privilege access",
  tags: ["secrets", "encryption", "aescbc", "etcd"],
  summary:
    "Know the EncryptionConfiguration file, how to wire it into kube-apiserver, how to prove a Secret is really encrypted in etcd, and how to rotate a key.",
  notes: [
    "Secrets are base64-encoded by default, not encrypted. Encryption at rest is an API server feature: --encryption-provider-config pointing at an EncryptionConfiguration file.",
    "Providers: identity (no encryption), aescbc (the expected answer), aesgcm, secretbox, and kms (delegated KMS plugin; cloud KMS with a DEK cache). Put the strong provider first, identity last as a fallback.",
    "The key must be base64 of exactly 32 bytes for aescbc. A wrong length is the classic reason encryption silently does nothing.",
    "Only resources listed are encrypted; the canonical entry is resources: [secrets] - add configmaps if the task asks.",
    "Verify by reading etcd directly: the stored value should start with 'k8s:enc:aescbc:v1:key1'. If it looks like plain base64 JSON, your flag or your provider list is wrong.",
    "Rotation: prepend the new key, restart the API server, then rewrite existing objects so they are re-encrypted under the new key.",
    "Access control is half of the story: RBAC on secrets, no secrets in env vars of wide-read service accounts, and never print a Secret value into shell history in an exam."
  ],
  commands: [
    { cmd: "head -c 32 /dev/urandom | base64", why: "Generate the 32-byte aescbc key on Linux. PowerShell equivalent: [Convert]::ToBase64String([byte[]](1..32 | ForEach-Object { Get-Random -Maximum 256 }))" },
    { cmd: "grep -n 'encryption-provider-config' /etc/kubernetes/manifests/kube-apiserver.yaml", why: "Check whether encryption is already enabled - and where the config file is expected." },
    { cmd: "kubectl -n kube-system exec etcd-<node> -- etcdctl get /registry/secrets/prod/api-token --print-value-only | head -c 80", why: "Look for the k8s:enc:aescbc:v1:key1 prefix. That output is your proof." },
    { cmd: "kubectl get secrets --all-namespaces -o json | kubectl replace -f -", why: "Force re-encryption of existing Secrets after a key rotation." },
    { cmd: "kubectl create secret generic api-token --from-literal=token='s3cr3t' -n prod && kubectl get secret api-token -n prod -o jsonpath='{.data.token}' | base64 -d", why: "Understand that default Secret handling is encoding, not encryption - the reason the encryption task exists." },
    { cmd: "kubectl create role secrets-reader --verb=get --resource=secrets --resource-name=api-token -n prod", why: "Narrow a ServiceAccount to exactly the Secret it needs." },
    { cmd: "kubectl auth can-i list secrets -A --as=system:serviceaccount:prod:default", why: "Prove the namespace default account cannot sweep Secrets." }
  ],
  yaml: [
    {
      title: "EncryptionConfiguration (/etc/kubernetes/encryption/encryption-config.yaml)",
      body: `apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
    - secrets
    - configmaps
    providers:
    - aescbc:
        keys:
        - name: key1
          secret: <BASE64_ENCODED_32_BYTES>
    - identity: {}`
    },
    {
      title: "Secret consumed as a read-only volume, with immutable Secret",
      body: `apiVersion: v1
kind: Secret
metadata: { name: api-token, namespace: prod }
type: Opaque
immutable: true
stringData:
  token: s3cr3t
---
apiVersion: v1
kind: Pod
metadata: { name: api, namespace: prod }
spec:
  containers:
  - name: app
    image: ghcr.io/org/api:1.4.0
    env:
    - name: API_TOKEN
      valueFrom:
        secretKeyRef: { name: api-token, key: token, optional: false }
    volumeMounts:
    - { name: token, mountPath: /etc/api-token, readOnly: true }
  volumes:
  - name: token
    secret: { secretName: api-token }`
    }
  ],
  gotchas: [
    "Encryption is applied on write. Existing Secrets are not rewritten automatically - hence the 'kubectl get secrets -A -o json | kubectl replace -f -' step, which many people forget and lose points for.",
    "Deleting the identity provider from the file is fine only if you can guarantee you will never need to decrypt with keys removed. Removing a key while objects still reference it makes them unreadable forever.",
    "Secrets mounted as env vars appear in 'kubectl describe pod' output? No - env values from secretKeyRef are shown as Secret references, but a plain env value is visible. Prefer secretKeyRef/projected volumes, never literal env values.",
    "A ServiceAccount with list secrets cluster-wide (system:discovery leftovers, or an over-broad ClusterRole) is a common finding in 'audit this cluster' tasks."
  ],
  docs: [
    { label: "Encrypting Secret Data at Rest (full procedure + verification)", url: "https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/" },
    { label: "Secrets concepts (usage, tradeoffs, immutability)", url: "https://kubernetes.io/docs/concepts/configuration/secret/" }
  ]
},

{
  id: "ms-secrets-external",
  domain: "microservices",
  title: "External secret stores and secretless workloads",
  tags: ["external-secrets", "csi-driver", "sealed-secrets", "vault"],
  summary:
    "The modern answer to 'manage Kubernetes secrets' is to not store them in etcd at all: sync them from an external store, mount them as ephemeral inline volumes, or seal them for GitOps.",
  notes: [
    "CSI Secrets Store driver (secrets-store.csi.k8s.io) mounts a provider's secret directly into the Pod as an inline ephemeral volume via a SecretProviderClass - nothing lands in etcd when syncSecret: false.",
    "External Secrets Operator syncs from AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, HashiCorp Vault and generic HTTP backends, writing Kubernetes Secret objects on a refreshInterval (with CEL transformation for value rewriting). Modern CRDs: ClusterSecretStore/SecretStore plus ExternalSecret with dataFrom.find.",
    "Sealed Secrets (kubeseal -> SealedSecret) make a Secret safe to commit to Git: only the controller in the cluster can decrypt it with its re-encrypted? (asymmetric) key. Good for GitOps where the secret must live in the repo.",
    "Secretless patterns: short-lived bound ServiceAccount tokens with an audience, workload identity federation (cloud STS instead of long-lived keys), KMS-backed delegated encryption for the Secret objects you must keep.",
    "Rotate anyway: external stores reduce the blast radius but an old Secret in etcd is still readable - combine with RBAC and audit."
  ],
  commands: [
    { cmd: "helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace", why: "Install the operator a 'manage secrets properly' task assumes." },
    { cmd: "kubectl get externalsecret -A -o wide ; kubectl describe externalsecret api-token -n prod", why: "Check sync status and refresh errors (status.conditions). " },
    { cmd: "kubectl get secretproviderclass -A ; kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{\"  \"}{.spec.volumes[?(@.csi.driver==\"secrets-store.csi.k8s.io\")].csi.volumeAttributes}{\"\\n\"}{end}'", why: "Show which Pods mount provider-backed secrets." },
    { cmd: "kubeseal --format yaml < secret.yaml > sealed-secret.yaml && kubectl apply -f sealed-secret.yaml", why: "The GitOps-safe path: seal locally, commit, controller decrypts in-cluster." },
    { cmd: "kubectl get secrets -A -o json | jq -r '.items[] | select(.type==\"kubernetes.io/service-account-token\") | .metadata.namespace+\"/\"+.metadata.name'", why: "Legacy long-lived SA token Secrets sitting in etcd are exactly what bound tokens replace." }
  ],
  yaml: [
    {
      title: "SecretProviderClass mounting a provider secret without putting it in etcd",
      body: `apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata: { name: api-provider, namespace: prod }
spec:
  provider: vault
  parameters:
    vaultAddress: "http://vault.vault.svc:8200"
    secretPath: "kv/api"
    roleName: "api-role"
    objects: |
      - objectName: "api-token"
        secretPath: "kv/api"
        secretKey: "token"
---
apiVersion: v1
kind: Pod
metadata: { name: api, namespace: prod }
spec:
  containers:
  - name: app
    image: ghcr.io/org/api:1.4.0
    volumeMounts:
    - name: secrets-store-inline
      mountPath: "/mnt/secrets-store"
      readOnly: true
  volumes:
  - name: secrets-store-inline
    csi:
      driver: secrets-store.csi.k8s.io
      readOnly: true
      volumeAttributes:
        secretProviderClass: "api-provider"`
    },
    {
      title: "ExternalSecret pulling from an external store",
      body: `apiVersion: external-secrets.io/v1
kind: SecretStore
metadata: { name: vault-backend, namespace: prod }
spec:
  provider:
    vault:
      server: "http://vault.vault.svc:8200"
      path: "kv"
      auth:
        kubernetes:
          mountPoint: "kubernetes"
          role: "api-role"
          serviceAccountRef: { name: api-sa }
---
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata: { name: api-token, namespace: prod }
spec:
  refreshInterval: 1h
  secretStoreRef: { kind: SecretStore, name: vault-backend }
  target: { name: api-token, creationPolicy: Owner }
  data:
  - secretKey: token
    remoteRef: { key: "api", property: "token" }`
    }
  ],
  gotchas: [
    "The CSI driver node pod is required for inline volumes; if you installed the operator but not the driver DaemonSet, Pods stall in ContainerCreating with 'volumeshare' / 'provider not initialized' errors.",
    "syncSecret: true recreates a Kubernetes Secret (i.e. it lands in etcd anyway) purely for backward compatibility - the hardened answer keeps it false.",
    "External Secrets Operator webhooks (CRD conversion) failing after an upgrade is a known trap: the ExternalSecret stays stuck in 'Reconciling'. Check the operator logs."
  ],
  docs: [
    { label: "External Secrets Operator docs", url: "https://external-secrets.io/latest/" },
    { label: "CSI Secrets Store driver", url: "https://secrets-store-csi-driver.sigs.k8s.io/" }
  ]
},

{
  id: "ms-tenancy",
  domain: "microservices",
  title: "Isolation technique 1: multi-tenancy",
  tags: ["multi-tenancy", "namespace", "quota", "isolation"],
  summary:
    "Namespace isolation is a stack: namespace + RBAC + ResourceQuota/LimitRange + PSA + NetworkPolicy + node/label separation. Missing one layer is the finding.",
  notes: [
    "Namespaces are not a security boundary by themselves: a Pod with cluster-scoped RBAC or hostPath access escapes them. Enforce all six layers to claim isolation.",
    "ResourceQuota caps counts and totals (pods, requests.cpu/memory, count of secrets); LimitRange sets default and max per-container requests - without them one tenant starves the node.",
    "Node isolation: nodeSelector/nodeName plus taints and tolerations keep a tenant's Pods on dedicated nodes; the tenant must not be able to read node objects (drop get nodes).",
    "Control-plane isolation for hard tenancy: virtual clusters (vCluster), one cluster per tenant, or separate API servers - know the tradeoffs conceptually.",
    "A shared kube-system NetworkPolicy is not enough: default-deny ingress inside each tenant namespace plus explicit cross-namespace allow rules is the pattern.",
    "Verify escape paths: exec into a tenant Pod and try 'kubectl auth can-i --list' with its token; if it can read secrets in another namespace, the tenancy is broken."
  ],
  commands: [
    { cmd: "kubectl create namespace tenant-a && kubectl label namespace tenant-a pod-security.kubernetes.io/enforce=restricted tier=tenant", why: "Namespace + PSA + a label you can select on." },
    { cmd: "kubectl create resourcequota tenant-quota -n tenant-a --hard='pods=20,requests.cpu=4,requests.memory=8Gi,secrets=20,configmaps=40'", why: "Tenant cannot exhaust the cluster." },
    { cmd: "kubectl create limitrange tenant-limits -n tenant-a --limits='cpu=500m,memory=1Gi'", why: "Default/max per container so one tenant cannot ask for 'requests.cpu: 100'; the YAML version below adds defaultRequest and max." },
    { cmd: "kubectl taint nodes pool-a tier=tenant:NoSchedule && kubectl patch deployment api -n tenant-a -p '{\"spec\":{\"template\":{\"spec\":{\"tolerations\":[{\"key\":\"tier\",\"operator\":\"Exists\",\"effect\":\"NoSchedule\"}],\"nodeSelector\":{\"tier\":\"tenant\"}}}}}'", why: "Pin the tenant onto its own node pool." },
    { cmd: "kubectl get ns -l tier=tenant -o wide ; kubectl get pods -A -o wide | grep -c tenant-a", why: "Kubernetes has no Tenant object - namespace labels plus a workload count are the practical tenant inventory." },
    { cmd: "kubectl exec -it -n tenant-a <pod> -- sh -c 'TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token); curl -sk -H \"Authorization: Bearer $TOKEN\" https://kubernetes.default.svc/api/v1/namespaces/tenant-b/secrets | head -c 200'", why: "The escape test: prove cross-namespace secret reads are refused." }
  ],
  yaml: [
    {
      title: "ResourceQuota + LimitRange pair for a tenant namespace",
      body: `apiVersion: v1
kind: ResourceQuota
metadata: { name: tenant-quota, namespace: tenant-a }
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
    persistentvolumeclaims: "10"
---
apiVersion: v1
kind: LimitRange
metadata: { name: tenant-limits, namespace: tenant-a }
spec:
  limits:
  - type: Container
    defaultRequest: { cpu: 100m, memory: 128Mi }
    default: { cpu: 500m, memory: 512Mi }
    max: { cpu: "1", memory: 1Gi }`
    }
  ],
  gotchas: [
    "A ResourceQuota created after Pods exist only limits new objects; existing over-quota Pods are grandfathered - recreate them.",
    "Taints alone do not keep a tenant off a node: the tenant needs the matching toleration, and you must forbid get/update on nodes so they cannot taint or cordon.",
    "DaemonSet-based security agents (Falco, CNI) run in kube-system and need hostPath/hostPID - exempt them in policies rather than breaking monitoring."
  ],
  docs: [
    { label: "Namespaces, quotas and limit ranges", url: "https://kubernetes.io/docs/concepts/policy/resource-quotas/" },
    { label: "Multi-tenancy best practices (per-cluster / virtual cluster options)", url: "https://kubernetes.io/docs/concepts/security/multi-tenancy/" }
  ]
},

{
  id: "ms-sandbox",
  domain: "microservices",
  title: "Isolation technique 2: sandboxed containers (gVisor, Kata)",
  tags: ["runtimeclass", "gvisor", "runsc", "kata", "sandbox"],
  summary:
    "RuntimeClass selects an alternative container runtime on the node. Install the runtime, create the RuntimeClass, then run the workload with runtimeClassName and prove it took effect.",
  notes: [
    "RuntimeClass (node.k8s.io/v1) has handler (matching the containerd/CRI-O runtime name), optional scheduling.nodeSelector, optional allowed.namespaces (restrict which namespaces may use it), and overhead.podOverhead.",
    "gVisor (runsc) is a user-space kernel: the syscall surface your container sees is emulated, so a kernel exploit in the app cannot reach the host kernel. Install runsc on the node and register a containerd runtime handler named runsc.",
    "Kata Containers boots a lightweight VM per Pod (QEMU/Cloud Hypervisor/Firecracker) - stronger isolation, real kernel per Pod, slower start-up; the containerd handler is typically 'kata' (io.containerd.kata.v2).",
    "Runtime selection is per Pod: runtimeClassName: gvisor. Verify: the Pod reports the class, and inside the container the kernel signature differs from the host (gVisor emulates its own kernel version).",
    "Not everything works in a sandbox: performance-sensitive syscalls, /dev access, some FUSE/eBPF tools, GPU drivers and hostPath mounts degrade or fail - know the tradeoff before promising it.",
    "Sandboxing complements, not replaces, seccomp/AppArmor/PSA: it protects the node from the container."
  ],
  commands: [
    { cmd: "kubectl get runtimeclass", why: "See which handlers exist before you assign one." },
    { cmd: "kubectl run sandboxed --image=busybox:1.36 --overrides='{\"spec\":{\"runtimeClassName\":\"gvisor\"}}' --command -- sleep 3600", why: "Run a Pod with a RuntimeClass using a one-off override." },
    { cmd: "kubectl get pod sandboxed -o jsonpath='{.spec.runtimeClassName}{\"\\n\"}'", why: "Confirm the class is on the spec (the grader checks this)." },
    { cmd: "kubectl exec sandboxed -- cat /proc/version ; uname -r ; uname -r", why: "Compare the in-container kernel signature against the host kernel - gVisor looks different." },
    { cmd: "kubectl get runtimeclass -o jsonpath='{range .items[*]}{.metadata.name}{\" handler=\"}{.handler}{\"\\n\"}{end}'", why: "Inventory the handlers your RuntimeClasses point at." },
    { cmd: "kubectl debug node/<node> -it --image=busybox:1.36 -- chroot /host sh -c 'which runsc; grep -A2 runsc /etc/containerd/config.toml'", why: "Confirm the runtime binary and its handler registration on the node - this is where the fix usually lives." },
    { cmd: "kubectl get events -A | grep -i 'runtime class' | tail", why: "'no runtime handler found' means the node is missing runsc/kata - fix the node, not the manifest." }
  ],
  yaml: [
    {
      title: "RuntimeClass restricted to a namespace, with node affinity",
      body: `apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata: { name: gvisor }
handler: runsc
allowed:
- namespaces: ["prod", "untrusted"]
scheduling:
  nodeSelector:
    sandbox: gvisor
---
apiVersion: v1
kind: Pod
metadata: { name: worker, namespace: untrusted }
spec:
  runtimeClassName: gvisor
  containers:
  - name: app
    image: ghcr.io/org/untrusted-job:1.0`
    },
    {
      title: "containerd runtime registration on the node (/etc/containerd/config.toml)",
      body: `version = 2
[plugins."io.containerd.grpc.v1.cri".containerd]
  default_runtime_name = "runc"
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
  runtime_type = "io.containerd.runc.v2"
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
  runtime_type = "io.containerd.runsc.v1"
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.kata]
  runtime_type = "io.containerd.kata.v2"`
    }
  ],
  gotchas: [
    "If the runtime handler is not registered in containerd/CRI-O config, the Pod fails with 'Failed to run Pod sandbox ... runtime handler \"runsc\" unknown' - the fix is on the node, then restart the runtime and kubelet.",
    "allowed.namespaces restricts who may use the class, not which Pods get it: a Pod without runtimeClassName still runs with the default runtime.",
    "A kindest/node image does not ship runsc or kata. On kind, practise the RuntimeClass object itself (handler, allowed.namespaces, scheduling.nodeSelector, overhead) and do the real gVisor/Kata run on a VM node where you can install the runtime binary.",
  ],
  docs: [
    { label: "RuntimeClass + gVisor (Kubernetes docs task)", url: "https://kubernetes.io/docs/tutorials/clusters/securing-your-cluster-with-sandboxed-containers/" },
    { label: "gVisor install guide", url: "https://gvisor.dev/docs/" }
  ]
},

{
  id: "ms-mtls",
  domain: "microservices",
  title: "Pod-to-Pod encryption: service mesh mTLS (Istio, Cilium, Linkerd)",
  tags: ["mtls", "istio", "cilium", "peerauthentication", "linkerd"],
  summary:
    "Service-to-service encryption is configured in the mesh control plane: strict mTLS for the data plane, per-service traffic policy, certificates managed by the mesh or cert-manager.",
  notes: [
    "PeerAuthentication (security.istio.io/v1) in the mesh root namespace with mtls.mode: STRICT makes the mesh refuse plaintext traffic; per-namespace overrides let you migrate incrementally (STRICT for prod, PERMISSIVE for a namespace still migrating).",
    "DestinationRule with trafficPolicy.tls.mode: ISTIO_MUTUAL makes the client sidecar present a mesh certificate; without it, plaintext out even when the server requires mTLS.",
    "Istio issues short-lived workload certificates that istiod rotates automatically (the usual default lifetime is around 24h - check workloadCertTTL in the mesh config of the version you are given), signed by istiod's own CA or by a cert-manager/intermediate CA. The default trust domain is cluster.local.",
    "Cilium does identity-based mTLS: auto mTLS (--enable-mutual-auth) authenticates by security identity with per-Pod certificates, and policies are enforced on identity rather than IP - plus egress to a hostname via toFQDNs.",
    "Linkerd mTLS is on by default for injected Pods: the mesh issues and rotates per-workload certificates, Server/DefaultServer policy objects decide which traffic must be encrypted and which identity may reach a service, and 'linkerd check' validates the trust chain.",
    "Non-mesh option: application-level TLS with cert-manager Certificates, or SPIFFE/SPIRE workload identities if you need identity that leaves the cluster."
  ],
  commands: [
    { cmd: "istioctl install --set profile=demo -y", why: "Install a mesh you can practise on (demo profile includes extras for labs)." },
    { cmd: "kubectl label namespace prod istio-injection=enabled --overwrite && kubectl rollout restart deploy -n prod", why: "Sidecars only join Pods created/restarted after the label." },
    { cmd: "kubectl apply -f peerauthentication-strict.yaml && kubectl get peerauthentication -A -o yaml | grep -A3 mtls", why: "Flip to STRICT and show it is applied." },
    { cmd: "kubectl exec -c istio-proxy <pod> -n prod -- curl -s localhost:15000/stats/prometheus | grep -iE 'ssl.connection_error|upstream_cx_tls' | head", why: "Sidecar stats prove TLS connections are actually being made." },
    { cmd: "kubectl run plain --rm -it --image=curlimages/curl -n prod -- curl -v --max-time 5 http://api.prod.svc.cluster.local:8080/healthz", why: "A non-mesh Pod should fail against STRICT mTLS - that failure is your proof." },
    { cmd: "cilium status --verbose | grep -iE 'mutual|auth|mTLS' ; cilium policy get | head -40", why: "Cilium's own view of mutual authentication and policy state." },
    { cmd: "hubble observe -n prod --verbatim | head -30", why: "Verify what traffic is flowing and that encrypted paths are the only ones." },
    { cmd: "linkerd check && linkerd viz tap deploy/api -n prod", why: "Linkerd's health check plus a live traffic tap." }
  ],
  yaml: [
    {
      title: "Istio strict mTLS (mesh-wide) + client traffic policy",
      body: `apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata: { name: default, namespace: istio-system }
spec:
  mtls: { mode: STRICT }
---
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata: { name: api-mtls, namespace: prod }
spec:
  host: api.prod.svc.cluster.local
  trafficPolicy:
    tls: { mode: ISTIO_MUTUAL }`
    },
    {
      title: "Cilium network policy: identity-based allow + deny metadata endpoint",
      body: `apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata: { name: api-egress, namespace: prod }
spec:
  endpointSelector:
    matchLabels: { app: api }
  egressDeny:
  - toEntities:
    - host
    - remote-node
  - toCIDR:
    - 169.254.169.254/32
  egress:
  - toEndpoints:
    - matchLabels: { "k8s:io.kubernetes.pod.namespace": prod, app: database }
    toPorts:
    - ports: [{ port: "5432", protocol: TCP }]`
    }
  ],
  gotchas: [
    "STRICT mTLS applied before every workload has a sidecar breaks the namespace - migrate namespace by namespace and keep PERMISSIVE where you still need plaintext from non-mesh clients.",
    "PeerAuthentication in the app namespace and PeerAuthentication in istio-system are different scopes: the mesh-wide one lives in the root namespace.",
    "A Gateway is the boundary: traffic entering the mesh from outside is TLS-terminated at the Gateway, and mesh-internal mTLS only starts after it. 'Pod-to-Pod encryption' tasks want the DestinationRule, not just the Gateway.",
    "Mesh CA certificates are workload-scoped; a Pod with hostNetwork or a non-injected Pod has no mesh identity and cannot present one."
  ],
  docs: [
    { label: "Istio security concepts (mTLS, PeerAuthentication, DestinationRule)", url: "https://istio.io/latest/docs/concepts/security/" },
    { label: "PeerAuthentication reference (mtls.mode values)", url: "https://istio.io/latest/docs/reference/config/security/peer-authentication/" },
    { label: "Cilium security docs (mutual authentication, identity-based policy)", url: "https://docs.cilium.io/en/stable/security/" }
  ]
},

/* ---------------------------------------- Supply Chain Security */

{
  id: "sc-base-image",
  domain: "supply-chain",
  title: "Minimize base image footprint",
  tags: ["distroless", "scratch", "multistage", "nonroot"],
  summary:
    "Fewer packages, fewer CVEs, no shell. Know the distroless variants, how to write a multi-stage build, and how to prove the image got smaller and safer.",
  notes: [
    "Order of preference: scratch (your static binary only) > distroless static / static-nonroot > distroless base(-nonroot) / language variants > slim variants of a distro > full distro.",
    "Static Go/Rust binary + scratch needs CA certs for TLS calls: COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ (scratch has nothing at all).",
    "distroless images have no shell and no package manager - debug with an ephemeral debug container (kubectl debug) or a companion debug image instead of installing tools in the production image.",
    "nonroot variants run as uid 65532 and set /tmp? (they mount no writable fs - pair with readOnlyRootFilesystem and an emptyDir for scratch space).",
    "Multi-stage: builder stage compiles, final stage COPY --from=builder only the artifact; the final stage must not copy the toolchain or /var/cache/apt.",
    "Also shrink: CGO_ENABLED=0 for Go, apt-get install --no-install-recommends + rm -rf /var/lib/apt/lists/*, pip install --no-cache-dir, npm ci --omit=dev."
  ],
  commands: [
    { cmd: "docker build -t app:v1.0.0 .", why: "The build itself; keep stage names so you can compare stage sizes." },
    { cmd: "docker image inspect app:v1.0.0 --format '{{.Config.User}} {{.Config.Entrypoint}} {{.Size}}'", why: "Confirm the user is non-root and read the size in bytes." },
    { cmd: "docker history --no-trunc app:v1.0.0 | head -20", why: "Layer-by-layer proof that the toolchain did not leak into the final image." },
    { cmd: "docker images app --format '{{.Repository}}:{{.Tag}} {{.Size}}'", why: "Measure before/after the footprint work - quantify the improvement." },
    { cmd: "trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 app:v1.0.0", why: "The scan that proves the smaller image is also less vulnerable." },
    { cmd: "syft app:v1.0.0 -o table | head -30 ; syft app:v1.0.0 -o spdx-json > sbom.json", why: "Know what is actually inside the image: the SBOM is the artifact you keep." },
    { cmd: "kubectl debug -it api --image=busybox:1.36 --target=app -- sh", why: "Debug a shell-less Pod with an ephemeral container that shares the process namespace (--target) instead of shipping a fatter production image." }
  ],
  yaml: [
    {
      title: "Multi-stage Dockerfile to a nonroot distroless image",
      body: `# syntax=docker/dockerfile:1
FROM golang:1.23 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOFLAGS=-trimpath go build -ldflags="-s -w" -o /out/app ./cmd/api

FROM gcr.io/distroless/static-nonroot:nonroot
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build --chown=nonroot:nonroot /out/app /app
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/app"]`
    },
    {
      title: "Scratch variant (smallest, needs explicit CA certs)",
      body: `FROM golang:1.23 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/app ./cmd/api

FROM scratch
COPY --from=build /out/app /app
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
USER 65532:65532
ENTRYPOINT ["/app"]`
    }
  ],
  gotchas: [
    "scratch + distroless cannot run entrypoints that need a shell; ENTRYPOINT must be the binary itself. If your Dockerfile ends with 'CMD [\"/bin/sh\", \"-c\", ...]' it is not compatible.",
    "A nonroot image whose binary cannot bind 8080 because it runs as uid 65532 - ports below 1024 need CAP_NET_BIND_SERVICE (and PSA restricted only allows that with drop ALL). Use 8080+ instead.",
    "No shell breaks liveness/readiness probes written as 'sh -c' commands - use httpGet/tcpSocket probes.",
    "'--no-cache-dir', '--no-install-recommends' and removing apt lists are what actually change the CVE count; a smaller image that still installs the compiler is not smaller."
  ],
  docs: [
    { label: "distroless images and variants", url: "https://github.com/GoogleContainerTools/distroless" },
    { label: "Debug containers (ephemeral) for shell-less Pods", url: "https://kubernetes.io/docs/tasks/debug/debug-container/" }
  ]
},

{
  id: "sc-supply",
  domain: "supply-chain",
  title: "Understand your supply chain: SBOM, provenance, artifact repositories",
  tags: ["sbom", "provenance", "slsa", "pipeline", "reproducibility"],
  summary:
    "You must be able to answer: where did this image come from, what is in it, who built it, and how do I deploy exactly that artifact reproducibly.",
  notes: [
    "SBOM = the inventory of components inside an image. Generate it at build time (syft, or the SBOM your build tool emits - BuildKit and kaniko can produce one) and keep it next to the image in the registry as an OCI artifact. syft writes spdx-json, cyclonedx-json and table formats.",
    "Provenance/build SLSA: build metadata (who, where, which builder, source commit) attested as an OCI attestation - cosign attest --type dsse/slsa or BuildKit/SLSA generation; verify it in admission to refuse images built outside your pipeline.",
    "Naming for reproducibility: never :latest; use immutable tags (git sha or semver + build id), and deploy by digest registry/org/app@sha256:... - the digest is the identity, the tag is a mutable alias.",
    "The chain is source -> build -> scan/sign -> registry -> admission verification -> deploy -> runtime monitoring. Know each link and what breaks it (unsigned build, unscanned image, tag mutation, unverified pull).",
    "Artifact repositories keep more than images: SBOMs, attestations, CVE reports, signing keys, and the IaC manifests. An 'understand your supply chain' task wants you to name these artifacts, not only tools.",
    "Sigstore components: Fulcio (short-lived signing certificate), Rekor (transparency log), TUF/root trust. Keyless signing = your OIDC identity + a Fulcio cert + a Rekor entry."
  ],
  commands: [
    { cmd: "syft dir:. -o spdx-json > sbom.json ; syft registry:ghcr.io/org/app:v1.0.0 -o cyclonedx-json > sbom.cdx.json", why: "Generate SBOMs for source and for the pushed image." },
    { cmd: "cosign attest --predicate sbom.json --type spdx ghcr.io/org/app@sha256:<digest>", why: "Attach the SBOM to the image as an attestation." },
    { cmd: "cosign verify-attestation --type spdx --certificate-identity-regexp 'https://github.com/org/.*' --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' ghcr.io/org/app@sha256:<digest>", why: "Verify the attestation came from your pipeline - the modern keyless verification pattern." },
    { cmd: "docker buildx build --metadata-file meta.json --attest type=provenance,mode=min -t ghcr.io/org/app:v1.0.0 --push . && cat meta.json", why: "Build with a BuildKit provenance (SLSA-style) attestation attached and capture the image descriptor metadata at build time." },
    { cmd: "kubectl get pod api -n prod -o jsonpath='{.status.containerStatuses[0].imageID}'", why: "Show which digest is actually running - the reproducibility check." },
    { cmd: "cosign download sbom ghcr.io/org/app:v1.0.0 | head -40 ; cosign attach sbom --sbom sbom.json ghcr.io/org/app@sha256:<digest>", why: "Fetch and attach SBOM artifacts directly." },
    { cmd: "crane digest ghcr.io/org/app:v1.0.0", why: "Resolve a mutable tag into the immutable digest you should pin in the manifest (go-containerregistry crane; regctl image digest is the equivalent)." },
  ],
  yaml: [
    {
      title: "Deploy by digest (identity, not alias)",
      body: `apiVersion: apps/v1
kind: Deployment
metadata: { name: api, namespace: prod }
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: api
        image: ghcr.io/org/api@sha256:2b7f0d1d...   # immutable identity
        imagePullPolicy: IfNotPresent`
    },
    {
      title: "CI pipeline shape (what to write on a whiteboard question)",
      body: `stage                 what happens                        gate / artifact
build    compile, tag by git sha                    image + digest
scan     trivy image, kubesec, kubelinter           CVE report + lint log; fail HIGH/CRITICAL
sign     cosign sign + attest (keyless OIDC)        signature, SBOM attestation
push     push to an allow-listed registry           cosign tree shows the signature
admit    Kyverno verifyImages / ImagePolicyWebhook  unsigned or foreign image is rejected
deploy   rollout of the new pinned digest           rollout history + imageID check
runtime  Falco rules + API audit log + alerts       alert history feeds the next build

Rules to state out loud: no :latest, one build per commit, sign at build time and not at
deploy time, verify before an image is allowed to run, keep SBOM + attestation + CVE report
as build artifacts, and roll forward to a new digest instead of editing a live image.`
    }
  ],
  gotchas: [
    "cosign keyless verification in recent versions requires explicit --certificate-identity (or --certificate-identity-regexp) and --certificate-oidc-issuer; without them verification is refused - that strictness is exactly what a CKS answer wants.",
    "An attestation is only useful if admission enforces it. Generating an SBOM that nothing checks is theatre; the scored part is the Kyverno/ImagePolicyWebhook rule.",
    "Digest pinning breaks nothing but requires your CD to update the digest on each release - describe how, or the task's 'reproducible build' point is lost.",
    "Registry mirroring (pull-through cache) changes provenance: verify what you pull, not what the upstream published."
  ],
  docs: [
    { label: "cosign attestation + SBOM docs", url: "https://docs.sigstore.dev/cosign/sign/overview/" },
    { label: "syft (SBOM generation)", url: "https://github.com/anchore/syft" }
  ]
},

{
  id: "sc-sign",
  domain: "supply-chain",
  title: "Sign and validate artifacts (cosign, Kyverno verifyImages, ImagePolicyWebhook)",
  tags: ["cosign", "verifyimages", "keyless", "admission"],
  summary:
    "Sign at build, verify at admission. Three mechanisms you should be able to set up: cosign sign/verify, a Kyverno verifyImages policy, and the ImagePolicyWebhook admission plugin.",
  notes: [
    "Keyless signing: cosign sign ghcr.io/org/app@sha256:<digest> with your OIDC identity (GitHub Actions OIDC in CI); the signature is stored as an OCI attachment in the registry and logged in Rekor.",
    "Key-based signing: cosign generate-key-pair (cosign.key/cosign.pub private key) then cosign sign --key cosign.key <image>; verification uses the public key. Practical for a private registry lab.",
    "Always sign the digest, not the tag: a signature on a mutable tag can be moved to a different image.",
    "Kyverno verifyImages matches imageReferences with a wildcard pattern and checks attestations: signature (publicKeys or keyless issuer/subject), and can also require an SBOM/Vulnerability attestation - enforce unsigned images out at admission.",
    "ImagePolicyWebhook is an API server admission plugin using an AdmissionConfiguration + webhook kubeconfig; it needs a webhook service (policy engine) to answer - set evalMode Audit before Deny.",
    "Kubernetes also has alpha Pod image verification (imageVerificationPolicy: PreferSigned on the Pod spec) - know it exists, but prefer Kyverno in the exam unless the task names it."
  ],
  commands: [
    { cmd: "cosign generate-key-pair", why: "Key-based pair for a private registry lab (passphrase protected cosign.key)." },
    { cmd: "cosign sign --key cosign.key ghcr.io/org/app@sha256:<digest>", why: "Sign the digest with your own key." },
    { cmd: "cosign verify --key cosign.pub ghcr.io/org/app@sha256:<digest>", why: "Verify locally; the JSON payload is the signature critical data." },
    { cmd: "cosign verify ghcr.io/org/app@sha256:<digest> --certificate-identity-regexp '^https://github.com/org/repo/.+' --certificate-oidc-issuer https://token.actions.githubusercontent.com", why: "Keyless verification against the CI identity - the exam-style answer." },
    { cmd: "cosign public-key --key cosign.key > cosign.pub ; cosign copy ghcr.io/org/app:v1.0.0 registry.internal.local/org/app:v1.0.0", why: "Copy an image together with its signatures/attestations into your allow-listed registry." },
    { cmd: "cosign tree ghcr.io/org/app:v1.0.0", why: "List attached signatures and attestations - prove what the registry holds." },
    { cmd: "kubectl apply -f kyverno-verify-images.yaml && kubectl run unsigned --image=docker.io/library/nginx:latest -n prod -- sleep 30", why: "Prove the verify policy rejects an unsigned/foreign image." },
    { cmd: "kubectl logs -n kyverno deploy/kyverno-admission-controller | grep -i 'verify image' | tail -20", why: "Rejections are logged with the reason - your verification evidence." }
  ],
  yaml: [
    {
      title: "Kyverno verifyImages: require a keyless signature from your pipeline",
      body: `apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: verify-signed-images }
spec:
  validationFailureAction: Enforce
  rules:
  - name: verify-signature
    match:
      any:
      - resources:
          kinds: [Pod]
          imageReferences: ["registry.internal.local/*"]
    exclude:
      any:
      - resources:
          namespaces: ["kube-system", "kyverno", "falco"]
    verifyImages:
    - imageReferences: ["registry.internal.local/*"]
      mutateImage: false
      attestations:
      - type: signature
        attestors:
        - entries:
          - keys:
              publicKeys: |-
                -----BEGIN PUBLIC KEY-----
                <cosign.pub contents>
                -----END PUBLIC KEY-----`
    },
    {
      title: "ImagePolicyWebhook wiring (API server flags + config)",
      body: `# kube-apiserver static pod flags
- --enable-admission-plugins=NodeRestriction,PodSecurity,ImagePolicyWebhook
- --admission-control-config-file=/etc/kubernetes/kube/admission-config.yaml

# /etc/kubernetes/kube/admission-config.yaml
apiVersion: apiserver.config.k8s.io/v1alpha1
kind: AdmissionConfiguration
plugins:
- name: ImagePolicyWebhook
  configuration:
    imagePolicyFile: /etc/kubernetes/kube/image-policy.json

# image-policy.json: point at your webhook service, start in Audit mode
{
  "kind": "ImagePolicyConfig",
  "apiVersion": "imagepolicy.k8s.io/v1alpha1",
  "imagePolicy": {
    "connectionBackoff": { "line": 0, "groups": 10 },
    "kubeConfigFile": "/etc/kubernetes/kube/image-policy-kubeconfig.yaml",
    "timeout": 10,
    "retryAttempts": 2
  },
  "imagePolicyWebhook": {
    "evalMode": "Audit"
  }
}`
    }
  ],
  gotchas: [
    "cosign signatures are stored in the registry as OCI artifacts; if your registry does not support referrers (or you copied the image without cosign copy), verification fails even though the image is fine.",
    "mutateImage: false is what makes verifyImages a deny rather than a rewrite - without it Kyverno may try to resolve to a verified digest and the task outcome changes.",
    "Kyverno's verifyImages block has changed shape between releases (attestations list vs attestors/signature, keyless issuer+subject vs publicKeys). Inspect the installed schema first: kubectl explain clusterpolicy.spec.rules.verifyImages",
    "Deny mode with an unreachable webhook = no Pods scheduled. Set Audit, test, then switch - and make sure the webhook has RBAC to read the images it evaluates."
  ],
  docs: [
    { label: "cosign sign/verify/attest reference", url: "https://github.com/sigstore/cosign" },
    { label: "Kyverno verifyImages docs", url: "https://kyverno.io/docs/writing-policies/verify-images/" }
  ]
},

{
  id: "sc-registries",
  domain: "supply-chain",
  title: "Minimize admission of images from public registries",
  tags: ["registry", "pullsecret", "allowlist", "private-registry"],
  summary:
    "Pull only from registries you control, with credentials that are not baked into manifests, and block anything else at admission.",
  notes: [
    "imagePullSecrets on the ServiceAccount (not on each Pod) is the clean pattern: kubectl patch serviceaccount default -p '{\"imagePullSecrets\":[{\"name\":\"regcred\"}]}'.",
    "docker-registry Secret type kubernetes.io/dockerconfigjson holds .dockerconfigjson; a Pod referencing an image from a private registry fails with ErrImagePull if the Secret is missing or misnamed.",
    "Registry credential providers (kubelet credential provider plugins: ecr-credential-provider, gcr-credential-provider, az acr) give short-lived tokens instead of long-lived Secrets.",
    "Admission allow-list: Kyverno image pattern (or OPA) restricting imageReference to your registry host(s), plus 'no untagged images' and 'no :latest'.",
    "Air-gap/allow-list pattern: a pull-through cache or mirrored registry so nodes never dial docker.io; verify copied images keep their signatures (cosign copy).",
    "Know where the image is pulled from at runtime: kubelet pulls, so the node's network egress policy matters as much as the manifest."
  ],
  commands: [
    { cmd: "kubectl create secret docker-registry regcred --docker-server=registry.internal.local --docker-username=ci --docker-password='<token>' -n prod", why: "The standard private-registry credential Secret." },
    { cmd: "kubectl patch serviceaccount default -n prod -p '{\"imagePullSecrets\":[{\"name\":\"regcred\"}]}'", why: "Attach it to the namespace's default SA so every Pod gets it." },
    { cmd: "kubectl get sa default -n prod -o jsonpath='{.imagePullSecrets}'", why: "Verify the SA, not the Pod, carries it." },
    { cmd: "kubectl run priv --image=docker.io/library/nginx:latest -n prod -- sleep 30 ; kubectl get pod priv -n prod -o wide", why: "Watch ErrImagePull/ImagePullBackOff, then prove the admission policy blocks it earlier." },
    { cmd: "kubectl get pods -A -o jsonpath='{range .items[*]}{.spec.containers[*].image}{\"\\n\"}{end}' | sort -u", why: "Enumerate every registry host your cluster currently pulls from - the audit answer." },
    { cmd: "curl -sk https://registry.internal.local/v2/_catalog ; curl -sk https://registry.internal.local/v2/org/app/tags/list", why: "Registry-side view of what exists; a local registry is easy to stand up for these tasks." },
    { cmd: "kubectl debug node/<node> -it --image=busybox:1.36 -- chroot /host sh -c 'ss -tnp | head -20'", why: "See which registries and external hosts the node is actually dialling - kubelet pulls images, so node egress matters as much as the manifest." }
  ],
  yaml: [
    {
      title: "Registry allow-list policy (deny foreign registries, deny untagged)",
      body: `apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: restrict-image-registries }
spec:
  validationFailureAction: Enforce
  background: false
  rules:
  - name: only-internal-registry
    match:
      any:
      - resources:
          kinds: [Pod]
    exclude:
      any:
      - resources:
          namespaces: ["kube-system", "kyverno", "falco", "cert-manager"]
    validate:
      message: "Only registry.internal.local images are allowed."
      pattern:
        spec:
          containers:
          - image: "registry.internal.local/**"
          =(initContainers):
          - image: "registry.internal.local/**"
  # A pattern string cannot OR two registries, so the debug-image case gets its own rule.
  - name: approved-ephemeral-debug-images
    match:
      any:
      - resources:
          kinds: [Pod]
    validate:
      message: "Ephemeral (kubectl debug) containers must use an approved debug image."
      pattern:
        spec:
          =(ephemeralContainers):
          - image: "gcr.io/distroless/*"
  - name: images-must-be-digest-pinned
    match:
      any:
      - resources:
          kinds: [Pod]
    validate:
      message: "Images must be referenced by digest (@sha256:)."
      pattern:
        spec:
          containers:
          - image: "*@sha256:?*"
  - name: deny-latest-and-unqualified
    match:
      any:
      - resources:
          kinds: [Pod]
    validate:
      message: "Use an explicit tag or digest; never :latest."
      pattern:
        spec:
          containers:
          - image: "!*:latest"`
    }
  ],
  gotchas: [
    "ephemeralContainers (kubectl debug) are a real bypass: a policy that only matches containers lets a debug image from Docker Hub through. Cover initContainers and ephemeralContainers too.",
    "A pattern of '*@sha256:?*' with the leading wildcard means 'contains @sha256:'; a wrong wildcard silently matches everything. Test with --dry-run=server and a deliberately bad image.",
    "imagePullSecrets on a Pod override the SA list; if a Pod sets an empty imagePullSecrets: [] it loses the registry credential.",
    "Kubelet-side credential helpers require kubelet config (credentialProviderConfig) - admission policies do not fix a node that cannot authenticate to the registry."
  ],
  docs: [
    { label: "Using a private registry + imagePullSecrets", url: "https://kubernetes.io/docs/tasks/configure-access-secret-image-pulls/" },
    { label: "Secrets of type dockerconfigjson", url: "https://kubernetes.io/docs/concepts/configuration/secret/#docker-config-secrets" }
  ]
},

{
  id: "sc-static-analysis",
  domain: "supply-chain",
  title: "Static analysis of workloads and images (Trivy, Kubesec, KubeLinter, Conftest)",
  tags: ["trivy", "kubesec", "kubelinter", "conftest", "ci"],
  summary:
    "Two targets: the manifest (misconfiguration) and the image (CVEs + components). Know the four tools, their commands, and how to make a scan fail a build.",
  notes: [
    "Manifest security review: Kubesec scores risk (privileged, hostPath, unencrypted secrets, capability grants); KubeLinter lints manifests for correctness plus security checks; Conftest runs your own Rego rules against manifests.",
    "Image/cluster scanning: Trivy for CVEs (image, filesystem, config/IaC, k8s cluster-wide report), SBOM scanning, and secret leakage detection in images.",
    "Fail the build deterministically: exit codes with --exit-code 1 and severity filters, plus --ignore-unfixed to avoid blocking on CVEs with no fix (state the tradeoff).",
    "Cluster-wide scan: trivy k8s cluster --report summary shows vulnerable workloads mapped to namespaces - a strong answer for 'identify vulnerabilities in the deployment pipeline'.",
    "Know where the gate goes: pre-commit/CI (kubelinter + kubesec + trivy config), build (trivy image + syft sbom), admission (Kyverno/OPA), runtime (Falco/audit). Every gate is a point in a pipeline question.",
    "Vulnerability findings need owners: report severity, CVSS? (use Trivy's severity and 'fixed version'), and the patch action (bump base image, pin fixed digest)."
  ],
  commands: [
    { cmd: "trivy image --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed ghcr.io/org/app:v1.0.0", why: "The canonical CVE gate: non-zero exit on unfixed HIGH/CRITICAL." },
    { cmd: "trivy config ./manifests/ ; trivy image --input app.tar", why: "IaC/manifest misconfig scan, and scanning a saved image tarball." },
    { cmd: "trivy k8s cluster --report summary --exit-code 1", why: "Scan the live cluster and get a per-namespace vulnerability summary." },
    { cmd: "trivy sbom sbom.json", why: "Scan the SBOM artifact itself - fast component review without pulling the image." },
    { cmd: "kubesec scan deployment.yaml | head -40", why: "Risk-assessor output with risk assumptions and scores (privileged, hostPath, secret access)." },
    { cmd: "kubelinter lint ./manifests --exit-code 1", why: "Lint manifests for both correctness and security checks." },
    { cmd: "conftest test --policy policy/ ./manifests/", why: "Your own Rego rules as a gate: 'violation[msg] { ... }' policies in policy/*.rego." },
    { cmd: "trivy image --format json ghcr.io/org/app:v1.0.0 | jq -r '.Results[].Vulnerabilities[]? | [.Severity,.PkgName,.VulnerabilityID,.FixedVersion] | @tsv' | sort | head -20", why: "Machine-readable findings with the fixed version - the remediation list." }
  ],
  yaml: [
    {
      title: "Conftest Rego rule: deny privileged Pods",
      body: `package main

import data.kubernetes

violation[msg] {
  pod := kubernetes.pods[_]
  c := pod.spec.containers[_]
  c.securityContext.privileged == true
  msg := sprintf("Pod %s has privileged container %s", [pod.metadata.name, c.name])
}

violation[msg] {
  pod := kubernetes.pods[_]
  pod.spec.volumes[_].hostPath
  msg := sprintf("Pod %s mounts a hostPath volume", [pod.metadata.name])
}`
    },
    {
      title: "GitHub Actions gate (build -> scan -> sign -> deploy)",
      body: `jobs:
  build-scan-sign:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write        # keyless signing needs OIDC
    steps:
    - uses: actions/checkout@v4
    - run: kubelinter lint ./deploy/manifests --exit-code 1
    - run: kubesec scan ./deploy/manifests
    - run: docker build -t ghcr.io/org/app:\${GIT_SHA} .
    - run: trivy image --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed ghcr.io/org/app:\${GIT_SHA}
    - run: syft ghcr.io/org/app:\${GIT_SHA} -o spdx-json > sbom.json
    - run: docker push ghcr.io/org/app:\${GIT_SHA}
    - run: cosign sign --yes ghcr.io/org/app:\${GIT_SHA}
    - run: cosign attest --yes --type spdx --predicate sbom.json ghcr.io/org/app:\${GIT_SHA}`
    }
  ],
  gotchas: [
    "KubeLinter's command is 'kubelinter lint <path>'; a directory scan needs manifests that parse, so YAML templates (unrendered Helm) will error before any check runs.",
    "--ignore-unfixed hides real risk; say which CVEs you accepted and why - graders reward the stated tradeoff, not a green build.",
    "Trivy's 'Fixed Version' is the actionable column: bump the base image, not the app, in most findings.",
    "kubesec output is a score, not a pass/fail. Do not promise 'score 0'; promise 'no HIGH risk assumptions left'."
  ],
  docs: [
    { label: "Trivy docs (image, k8s, config, sbom modes)", url: "https://trivy.dev/latest/" },
    { label: "KubeLinter + Kubesec (static analysis of workloads)", url: "https://github.com/stackrox/kube-linter" }
  ]
},

/* ---------------------------------------- Monitoring, Logging and Runtime Security */

{
  id: "rt-falco",
  domain: "runtime-security",
  title: "Falco: behavioral analytics with custom rules",
  tags: ["falco", "syscall", "rule", "ebpf", "falcosidekick"],
  summary:
    "Install Falco, write a rule, prove the alert fires, then tune the false positives. This is the highest-frequency CKS tool task.",
  notes: [
    "Install as a DaemonSet through the Helm chart; on modern kernels prefer the modern eBPF probe driver (no kernel module compilation, works on kind and most managed nodes).",
    "A rule is: rule, desc, condition (syscall event + fields + macros/lists), output (fields), priority (informational..emergency), optional tags. Macros and lists are reusable and are how you tune a rule.",
    "Fields you must know: proc.cmdline, proc.pname, proc.pcmdline, container.id, container.image.repository, k8s.pod.name, k8s.ns.name, user.name, user.uid, fd.name, fd.directory? (fd.name is used for file paths), evt.type, evt.arg.*, proc.args.",
    "Verify behaviour two ways: exec a shell into an app container and watch 'kubectl logs' of the Falco Pod, or run 'falco --validation <file>' inside the Falco Pod to check rule syntax.",
    "Tune with overrides in falco_rules.local.yaml (append_custom_rules / custom_rules in Helm values) rather than editing the shipped ruleset - the shipped ruleset is huge and noisy on a demo cluster.",
    "Outputs: console (tty=true in the chart), file output, json_output for machine-readable alerts, the legacy gRPC output, and metrics engines exposed on the webserver port. Falcosidekick forwards alerts to Slack, Loki, Prometheus, generic webhooks and email, and pairs with Falcosidekick-UI for a dashboard. For API-activity detection load the k8saudit plugin and its rules.",
    "Design the output text deliberately: a graded task is answered from the alert line, so include user, command, pod, namespace and image fields in every custom rule you write."
  ],
  commands: [
    { cmd: "helm repo add falcosecurity https://falcosecurity.github.io/charts && helm repo update", why: "Add the chart repo before any Falco task." },
    { cmd: "helm install falco falcosecurity/falco -n falco --create-namespace --set driver.kind=modern_ebpf --set tty=true --set falcosidekick.enabled=true --set falcosidekick.webui.enabled=true", why: "Install with the modern driver, console output and alert forwarding enabled." },
    { cmd: "helm show values falcosecurity/falco | sed -n '1,80p'", why: "Flag names move between chart versions - read the installed chart's values instead of guessing." },
    { cmd: "kubectl get pods -n falco -o wide ; kubectl logs -n falco ds/falco --tail=40", why: "Driver load messages ('EBPF probe loaded' / 'kernel module') confirm the collector works." },
    { cmd: "kubectl exec -it <app-pod> -- sh -c 'cat /etc/shadow'", why: "Trigger the shipped 'Read sensitive file untrusted' rule - then see the alert in Falco logs." },
    { cmd: "kubectl exec -it <falco-pod> -n falco -- falco --validate /etc/falco/falco_rules.local.yaml", why: "Validate your custom rule file before the DaemonSet restarts. The flag name has moved between releases (--validate / --validation) - confirm with 'falco --help' in the container you are given." },
    { cmd: "kubectl exec -it <falco-pod> -n falco -- falco --list-rules | grep -i shell", why: "See which shipped rules already cover your scenario before writing a new one (use --list-events for the event names your condition may use)." },
    { cmd: "kubectl logs -n falco ds/falco | grep -i warning | tail -20", why: "Your proof that the alert fired: priority, output text and fields." },
    { cmd: "helm upgrade falco falcosecurity/falco -n falco --reuse-values --set custom_rules[0].rule='...' --set custom_rules[0].append=true", why: "Ship custom rules through values instead of editing files in the container." }
  ],
  yaml: [
    {
      title: "Custom rule: shell spawned inside a container + tune with a list",
      body: `- macro: my_app_containers [container.image.repository startswith "ghcr.io/org/"]
- list: my_app_pods [k8s.pod.name.startswith("api")]

- rule: Shell spawned in an app container
  desc: A shell was launched inside an application container.
  condition: spawned_process and container and shell_procs and my_app_containers
  output: >
    Shell in app container (user=%user.name command=%proc.cmdline parent=%proc.pname
    pod=%k8s.pod.name ns=%k8s.ns.name image=%container.image.repository)
  priority: WARNING
  tags: [process, container, cke]

- rule: Sensitive file read by a non-tool process
  desc: Someone read a credential file from inside a container.
  condition: open_read and container and fd.name in (/etc/shadow, /etc/passwd, /var/run/secrets/kubernetes.io/serviceaccount/token)
  output: >
    Credential file read (user=%user.name file=%fd.name pod=%k8s.pod.name ns=%k8s.ns.name
    command=%proc.cmdline)
  priority: CRITICAL`
    },
    {
      title: "falco.yaml keys you will actually touch (and the Helm values beside them)",
      body: `# falco.yaml - the parts a CKS task edits
json_output: true
json_include_output_property: true
log_level: info
stdout_output: { enabled: true }
file_output: { enabled: false, filename: /var/log/falco_events.json }
webserver:
  listen_port: 8765              # metrics / alert endpoint exposed by Falco
  k8s_metrics:
    enabled: true
    add_custom_metrics: true
rules_file:
  - /etc/falco/falco.yaml
  - /etc/falco/falco_rules.yaml
  - /etc/falco/falco_rules.local.yaml   # your overrides belong here, not in the shipped rules

# Helm chart values (read the installed chart: helm show values falcosecurity/falco)
driver:
  kind: modern_ebpf
collectors:
  kubernetes:
    enabled: true                # required for k8s.pod.name / k8s.ns.name in outputs
tty: true
custom_rules:
- rule: Shell spawned in an app container
  append: true
falcosidekick:
  enabled: true
  webui:
    enabled: true`
    }
  ],
  gotchas: [
    "No events usually means no driver: check 'kubectl logs' for the driver probe path, ensure the DaemonSet runs on the node you exec into, and confirm the collector is not filtered out.",
    "The default ruleset is very chatty on a lab cluster; a task that wants 'one alert' expects you to disable the noisy default rule or scope it (append_custom_rules with a disable override).",
    "Falco needs k8s metadata enrichment for k8s.pod.name to be populated - without the collectors/kubernetes enabled those fields print 'N/A'.",
    "Rule validation failures crashloop the Falco Pod. Validate inside the Pod first; the syntax error message points at the file and line."
  ],
  docs: [
    { label: "Falco rules syntax, macros, lists, fields", url: "https://falco.org/docs/rules/" },
    { label: "Falco Helm chart + Falcosidekick", url: "https://github.com/falcosecurity/charts" }
  ]
},

{
  id: "rt-audit",
  domain: "runtime-security",
  title: "Kubernetes audit logs: policy, retention and analysis",
  tags: ["audit-log", "audit-policy", "jq", "webhook"],
  summary:
    "Write an audit policy that captures what matters, wire it into the API server, then answer questions from the log with jq. Nearly every 'who did this?' task is answered here.",
  notes: [
    "Levels: None, Metadata (who/what/when, no body), Request (request body, no response), RequestResponse (both). Stages: RequestReceived, ResponseWritten, ResponseComplete, plus omitStages to avoid duplicate entries.",
    "Policy is a list of ordered rules; the first match wins. Put your high-value narrow rules first (privileged pods, secrets, RBAC objects) and a broad Metadata catch-all last.",
    "Flags: --audit-policy-file (required), --audit-log-path, --audit-log-maxage, --audit-log-maxbackup, --audit-log-maxsize, --audit-webhook-config-file, --audit-webhook-mode (Batched or Metadata). Per-rule omitStages keeps a single request from being logged at several stages; recent releases also accept --audit-omit-stages.",
    "The audit event fields you will grep: user.username, user.groups, sourceIPs, verb, objectRef.resource/subresource/name/namespace, responseStatus.code, stage, level, requestObject, responseObject, annotations? (impersonated fields: user.extra).",
    "etcd request logging is a separate concern (etcd logs its own requests) and kubelet logs live in journalctl - neither is the API audit log; know which log answers which question.",
    "Ship logs out with the audit webhook to your SIEM (a Service with a kubeconfig), or read the file on the node - in a lab the file lives inside the control-plane node."
  ],
  commands: [
    { cmd: "docker exec kind-control-plane tail -n 200 /var/log/kubernetes/audit.log", why: "Where the audit log actually lives in a kind control-plane node." },
    { cmd: "kubectl exec -n kube-system kube-apiserver-<node> -- tail -n 500 /var/log/kubernetes/audit.log | jq -c 'select(.verb==\"create\" and .objectRef.resource==\"pods\") | {user:.user.username, ns:.objectRef.namespace, name:.objectRef.name, ts:.requestReceivedTimestamp}'", why: "Answer 'who created Pods and when' straight from the log." },
    { cmd: "kubectl exec -n kube-system kube-apiserver-<node> -- cat /var/log/kubernetes/audit.log | jq -r 'select(.objectRef.resource==\"secrets\") | [.requestReceivedTimestamp,.user.username,.verb,.objectRef.namespace,.objectRef.name] | @tsv' | tail -20", why: "The Secret-access investigation table." },
    { cmd: "grep -c '\"verb\":\"delete\"' /var/log/kubernetes/audit.log", why: "Run this on the control-plane node (SSH, or 'docker exec kind-control-plane sh -c \"...\"' in a kind lab) when jq is unavailable: bulk counts of destructive verbs." },
    { cmd: "kubectl exec -n kube-system kube-apiserver-<node> -- grep -oE 'audit[a-z-]*' /etc/kubernetes/manifests/kube-apiserver.yaml | sort -u", why: "Read which audit flags this cluster actually starts with - /etc/kubernetes is mounted into the API server container." },
    { cmd: "kubectl logs -n kube-system kube-apiserver-<node> | grep -i 'audit' | tail -20", why: "API server logs show audit webhook errors and whether the policy file loaded." }
  ],
  yaml: [
    {
      title: "Audit policy (/etc/kubernetes/policy/audit-policy.yaml)",
      body: `apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: None
  resources: [{ group: "", resources: ["events"] }]
- level: RequestResponse
  resources:
  - group: ""
    resources: [pods, pods/exec, pods/portforward, pods/proxy, secrets, configmaps]
- level: Metadata
  resources: [serviceaccounts, nodes]
- level: Metadata
  verbs: [get, list, watch]
  resources: [pods, deployments, services]
- level: Request
  users: ["system:node*"]
  verbs: [create, update, patch, delete]
- level: Metadata
  omitStages: ["RequestReceived"]`
    },
    {
      title: "Audit webhook config (kubeconfig pointing at your collector)",
      body: `apiVersion: v1
kind: Config
clusters:
- name: audit-collector
  cluster:
    server: https://audit-collector.monitoring.svc.cluster.local:8080
    certificate-authority: /etc/kubernetes/pki/ca.crt
users:
- name: kube-apiserver
  user:
    client-certificate: /etc/kubernetes/pki/front-proxy-client.crt
    client-key: /etc/kubernetes/pki/front-proxy-client.key
contexts:
- context:
    cluster: audit-collector
    user: kube-apiserver
  name: audit
current-context: audit`
    }
  ],
  gotchas: [
    "A policy with no catch-all rule drops everything after the last matching rule; a policy whose first rule is level: Metadata for '*' makes your targeted RequestResponse rule dead.",
    "Requests from kubelet (system:node) flood the log. Use a None rule for events/healthz and Metadata for system:node, or you will not find the interesting event.",
    "jq may not exist on the exam node - be ready to answer with grep/sed pipelines too.",
    "The audit log file needs a hostPath volume in the API server manifest; if a task says 'audit logging is enabled but empty', the mount or the path is the bug."
  ],
  docs: [
    { label: "Audit policy reference (levels, stages, webhook)", url: "https://kubernetes.io/docs/reference/config-api/audit-policy-v1/" },
    { label: "Auditing task guide + example policies", url: "https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/" }
  ]
},

{
  id: "rt-detect",
  domain: "runtime-security",
  title: "Detect threats across infrastructure, apps, network, data, users and workloads",
  tags: ["detect", "auditd", "hubble", "prometheus", "sysdig"],
  summary:
    "Each plane has its own sensor. Know which tool answers which question, and how to turn a raw alert into an investigated event.",
  notes: [
    "Workload/process plane: Falco (syscalls), plus crictl and kubelet logs for what actually started.",
    "API/user plane: Kubernetes audit log + Falco k8saudit plugin (API-activity rules) to catch privilege grants, secret sweeps and kubectl exec storms.",
    "Network plane: CNI/Hubble flow visibility, egress NetworkPolicy hits, DNS anomalies, cilium policy deny counts.",
    "Node/OS plane: auditd rules on sensitive files (/etc/kubernetes/manifests, /etc/shadow, /var/lib/kubelet), journald, sshd logs, package changes; sysdig for a live host view.",
    "Data plane: Secret access patterns, PVC access, object storage access outside the cluster.",
    "Metrics + alerting: Prometheus rules on Falco alerts (falcosidekick prometheus output), API server request rate/mutating request saturation, and 'kubectl get events' spikes as a cheap early signal."
  ],
  commands: [
    { cmd: "kubectl get events -A --sort-by=.lastTimestamp | tail -40", why: "Cheapest first look at cluster churn: pulls, probes, evictions, admission denials." },
    { cmd: "auditctl -w /etc/kubernetes/manifests/ -p wax -k k8s-manifests ; auditctl -w /etc/shadow -p wa -k shadow", why: "Watch control-plane manifests and credential files at the OS level." },
    { cmd: "ausearch -i -k k8s-manifests --start today | tail -30 ; aureport --summary | head -20", why: "auditd records into readable form (-i interprets numeric fields). Report flags vary by auditd version, so check 'aureport --help'." },
    { cmd: "journalctl -u kubelet --since '30 min ago' | grep -iE 'unauthorized|failed to|refused' | tail -20", why: "Kubelet-side auth failures and denied Pods." },
    { cmd: "hubble observe --namespace prod --to-fqdn api.example.com -o json | head -30", why: "Network-plane evidence of what a workload dialled out to." },
    { cmd: "crictl ps -a ; crictl inspect <container-id> | jq '.info.config? , .status.metadata' ; crictl logs <container-id> | tail -20", why: "Runtime-level truth about containers, including terminated ones." },
    { cmd: "sysdig -c top_procs ; sysdig 'proc.name = sh and container.id != host'", why: "Live host/process view when Falco coverage is not enough - Ctrl+C to stop, or capture for a fixed time (see 'sysdig --help' for that flag)." },
    { cmd: "kubectl get --raw /metrics | grep -E 'apiserver_current_inflight_requests|apiserver_request_total' | head", why: "API server saturation and request mix: is someone hammering LIST?" }
  ],
  yaml: [
    {
      title: "Prometheus alert on Falco alerts (via Falcosidekick metrics)",
      body: `groups:
- name: falco
  rules:
  - alert: FalcoCriticalAlert
    expr: sum by (rule, namespace) (increase(falco_events_alert{priority=~"critical|emergency"}[5m])) > 0
    for: 0m
    labels: { severity: critical }
    annotations:
      summary: "Falco: { $labels.rule } in { $labels.namespace }"
      description: "Runtime alert fired; investigate the Pod and its parent workload."`
    }
  ],
  gotchas: [
    "Falco alerts without a destination are invisible: wire Falcosidekick (or the gRPC/webhook output) before you claim detection coverage.",
    "auditd is a different system from the Kubernetes audit log: an exam question about 'audit' may want either - re-read the wording.",
    "'kubectl get events' is namespaced, short-lived (TTL) and can be empty when you need it; rely on the API audit log for historical questions."
  ],
  docs: [
    { label: "Falco k8saudit plugin (API activity detection)", url: "https://falco.org/docs/plugins/" },
    { label: "Hubble flow visibility (Cilium)", url: "https://docs.cilium.io/en/stable/observability/policy-metrics/" }
  ]
},

{
  id: "rt-ir",
  domain: "runtime-security",
  title: "Investigate an attack: phases, bad actors, containment",
  tags: ["incident", "triage", "containment", "forensics"],
  summary:
    "A CKS scenario hands you a compromised workload and asks: what happened, who did it, contain it, then fix the root cause. Practise the sequence until it is muscle memory.",
  notes: [
    "Sequence: preserve evidence -> scope the blast radius -> identify initial access (how it got in) -> identify escalation and persistence -> contain -> remediate -> prove remediation.",
    "Initial access in these scenarios is usually one of: an exposed service, a malicious image, a compromised ServiceAccount token, a privileged Pod, a leaked Secret in CI, or an unpatched node.",
    "Escalation/persistence to hunt for: new ClusterRoleBindings, privileged DaemonSet or CronJob, hostPath mount to /etc or /root, new SA token Secret, a Pod in kube-system, a mutating webhook, a static Pod dropped on a node, a new kubeconfig file.",
    "Exfiltration signals: unexpected egress flows, large POST to an external host, DNS tunnelling, a Pod with hostNetwork dialling 169.254.169.254.",
    "Containment that keeps the cluster alive: egress deny NetworkPolicy, scale the workload to zero, cordon/drain the node, revoke the SA/token, rotate the Secret, and only then delete the object.",
    "Who questions are answered by the API audit log (user.username, sourceIPs, impersonation) and Falco (which process in which Pod); never guess an identity."
  ],
  commands: [
    { cmd: "kubectl get pods -A -o json | jq -r '.items[] | select((.spec.hostNetwork==true) or (.spec.hostPID==true) or (.spec.containers[]?.securityContext.privileged==true) or (.spec.volumes[]? | has(\"hostPath\"))) | .metadata.namespace+\"/\"+.metadata.name'", why: "Enumerate every escape-capable workload in one pass." },
    { cmd: "kubectl get clusterrolebindings,rolebindings -A -o wide | sort -k4 | tail -30", why: "Recently added or cluster-admin-bound principals." },
    { cmd: "kubectl get deploy,ds,job,cronjob -A -o jsonpath='{range .items[*]}{.metadata.namespace}{\"/\"}{.metadata.name}{\"  \"}{.spec.template.spec.containers[0].image}{\"\\n\"}{end}' | sort -u | head -40", why: "Hunt persistence workloads running from an unexpected image." },
    { cmd: "kubectl logs <pod> -n prod --previous --tail=200 ; kubectl describe pod <pod> -n prod", why: "Last words of the workload: restart reason, exit code, probe failures." },
    { cmd: "kubectl cp prod/<pod>:/tmp/dropped-binary /tmp/evidence/dropped-binary && ls -l /tmp/evidence", why: "Pull evidence out before the object disappears." },
    { cmd: "kubectl debug node/<node> -it --image=busybox:1.36 -- chroot /host sh -c 'ps -ef | head -30; ss -tnp | head -20; ls -l /etc/kubernetes/manifests'", why: "Node forensics from a Pod: processes, connections, static manifests." },
    { cmd: "kubectl apply -f deny-all-egress-prod.yaml && kubectl patch deploy api -n prod -p '{\"spec\":{\"replicas\":0}}'", why: "Containment: cut the network first, then stop the workload." },
    { cmd: "kubectl cordon <node> && kubectl drain <node> --ignore-daemonsets --delete-emptydir-data --grace-period=30", why: "Remove the node from scheduling and evacuate it while keeping DaemonSets." }
  ],
  yaml: [
    {
      title: "Emergency containment policy (deny egress, allow DNS + one collector)",
      body: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: incident-contain-egress, namespace: prod }
spec:
  podSelector:
    matchLabels: { app: api }
  policyTypes: [Egress]
  egress:
  - to:
    - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } }
      podSelector: { matchLabels: { k8s-app: kube-dns } }
    ports: [{ protocol: UDP, port: 53 }]
  - to:
    - podSelector: { matchLabels: { app: siem-collector } }
    ports: [{ protocol: TCP, port: 9090 }]`
    }
  ],
  gotchas: [
    "Deleting the compromised Pod destroys evidence and does not remove persistence (a CronJob or DaemonSet re-creates it). Find the controller first.",
    "Revoking a ServiceAccount token requires deleting/rotating what issued it: bound tokens expire, legacy token Secrets do not - delete the Secret of type kubernetes.io/service-account-token.",
    "Node forensics need host access: 'kubectl debug node/...' chroot /host is the fast route when you cannot SSH. If the node is untrusted, take the snapshot and rebuild it.",
    "Containment that blocks DNS is a self-inflicted outage - every containment policy in your muscle memory must include the kube-dns allow rule."
  ],
  docs: [
    { label: "Debugging containers and nodes with ephemeral containers", url: "https://kubernetes.io/docs/tasks/debug/debug-cluster/" },
    { label: "API audit log (the who/when source)", url: "https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/" }
  ]
},

{
  id: "rt-immutability",
  domain: "runtime-security",
  title: "Ensure immutability of containers at runtime",
  tags: ["immutable", "readonly", "digest", "capabilities"],
  summary:
    "Immutable = nothing writes into the running container, nothing changes the image identity, and any change means a new digest rolled out.",
  notes: [
    "readOnlyRootFilesystem: true plus explicit writable mounts (emptyDir for /tmp, /var/run, app scratch) is the core control - it kills in-place tampering and dropped-binary persistence.",
    "Pin by digest and use imagePullPolicy: IfNotPresent; a digest reference makes the running bytes identical to what you scanned and signed (setting Always with a digest is refused).",
    "Drop ALL capabilities, allowPrivilegeEscalation: false, no privileged, no hostPath/hostDevice mounts into the container's writable set, runAsNonRoot with a numeric UID.",
    "No shell in the image + ephemeral debug containers for troubleshooting means nobody can 'fix' a running Pod by hand - changes go back through the pipeline.",
    "Mutable state belongs outside the container: ConfigMaps/Secrets mounted read-only, persistent volumes for data, init containers? for startup work, and no apt install at runtime.",
    "Immutable infrastructure: patch by replacing the Deployment with a new digest and rolling forward; 'kubectl edit deploy' on a live incident is how persistence survives."
  ],
  commands: [
    { cmd: "kubectl get pods -A -o json | jq -r '.items[] | select(.spec.containers[]?.securityContext.readOnlyRootFilesystem!=true) | .metadata.namespace+\"/\"+.metadata.name+\" \"+.spec.containers[0].name'", why: "Find every container with a writable root filesystem - the audit answer." },
    { cmd: "kubectl exec <pod> -n prod -- sh -c 'touch /tmp/x && echo writable; touch /etc/x 2>&1 | head -1'", why: "Prove which paths are writable in a running container." },
    { cmd: "kubectl get pod api -n prod -o jsonpath='{.spec.containers[0].image}{\"\\n\"}{.status.containerStatuses[0].imageID}{\"\\n\"}'", why: "Requested reference vs the digest actually running." },
    { cmd: "kubectl debug -it api -n prod --image=busybox:1.36 --target=app -- sh", why: "Debug without adding tools to the production container: an ephemeral container shares the process namespace, not the filesystem." },
    { cmd: "kubectl set image deploy/api api=ghcr.io/org/api@sha256:<new-digest> -n prod && kubectl rollout status deploy/api -n prod", why: "The immutable update path: new digest, rollout, verify." },
    { cmd: "kubectl get pods -n prod -o jsonpath='{range .items[*]}{.metadata.name}{\"  \"}{.spec.containers[0].image}{\"\\n\"}{end}'", why: "Confirm every replica now runs the new digest." }
  ],
  yaml: [
    {
      title: "Immutable Pod template",
      body: `apiVersion: apps/v1
kind: Deployment
metadata: { name: api, namespace: prod }
spec:
  replicas: 2
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        seccompProfile: { type: RuntimeDefault }
      containers:
      - name: api
        image: ghcr.io/org/api@sha256:<digest>
        imagePullPolicy: IfNotPresent
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities: { drop: ["ALL"] }
        volumeMounts:
        - { name: tmp, mountPath: /tmp }
        - { name: config, mountPath: /etc/api, readOnly: true }
      volumes:
      - { name: tmp, emptyDir: {} }
      - name: config
        configMap: { name: api-config }`
    }
  ],
  gotchas: [
    "readOnlyRootFilesystem without a writable /tmp breaks many apps and some runtimes' temp needs - mount emptyDir at the exact paths the app complains about, one at a time.",
    "A mutable tag plus imagePullPolicy: Always gives you a different image on every restart; a grader checking 'immutability' is looking for the digest.",
    "kubectl exec into a running container to change files is exactly what immutability forbids; the compliant path is an ephemeral debug container that shares the process namespace but not the filesystem.",
    "initContainers mount the same volumes: a read-only root plus a writable shared emptyDir is a persistence vector if an attacker can edit the init image."
  ],
  docs: [
    { label: "Ephemeral (debug) containers", url: "https://kubernetes.io/docs/concepts/workloads/pods/ephemeral-containers/" },
    { label: "Image pull policies + digest references", url: "https://kubernetes.io/docs/concepts/containers/images/" }
  ]
}
);
