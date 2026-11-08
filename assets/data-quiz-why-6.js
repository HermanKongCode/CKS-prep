/* CKS Prep - per-option rationales, Monitoring, Logging and Runtime Security. Shown only after the learner submits an answer. */
window.CKS_QUIZ_WHY_6 = {
  "q-rt-1": [
    "modern_ebpf loads BPF programs from userspace, so no kernel module build, no kernel headers and no DKMS toolchain are required.",
    "falco-driver-loader builds a kernel module from kernel headers, so without headers or a toolchain the build fails and no events flow.",
    "Modern eBPF programs load through the bpf syscall without kernel headers, so falling back to polling loses syscall coverage in Falco.",
    "Falco offers the modern eBPF probe, the classic probe and a userspace source, so a kernel module is optional rather than required."
  ],
  "q-rt-2": [
    "falco --validate points at the bad rule, macro or condition with its file and line, which a crashloop alone cannot tell you.",
    "A rule that fails to parse stops Falco during startup regardless of how much memory the DaemonSet container has available.",
    "The crash follows rule loading, not the collector, so switching drivers can break a working event source while the bad rule remains.",
    "Deleting the rule restores the Pod but discards the detection you were asked to add, and the syntax fault is never found."
  ],
  "q-rt-3": [
    "With Kubernetes metadata enabled Falco enriches events with the owning Pod and namespace, so k8s.pod.name and k8s.ns.name resolve.",
    "Container enrichment records the image reference of the container that produced the syscall, so repository and tag are usable fields.",
    "Process fields come from the event stream: Falco tracks the command line, parent process name and parent command line per process.",
    "Falco exposes event observations and enrichment, not the Pod spec; the privileged setting is read from the API object with kubectl."
  ],
  "q-rt-4": [
    "The local rules file loads after falco_rules.yaml and is meant for overrides, so tuning survives an upgrade of the shipped ruleset.",
    "A macro or list naming your application images narrows the rule condition, so it fires only for the workloads you care about.",
    "An override can disable a shipped rule or rewrite its condition, cutting alert volume without losing coverage the ruleset provides.",
    "Priority drives routing and filtering, so raising every rule to EMERGENCY makes severity meaningless and buries urgent events in noise.",
    "Disabling the event source stops Falco from seeing syscalls at all, which removes alerts but also removes runtime detection on that node."
  ],
  "q-rt-5": [
    "RequestResponse logs the request object and the response object, so the Secret payload and the API reply both appear in the event.",
    "The Request level logs the request body only, so a Secret read records the incoming request without the data the API returned.",
    "Metadata level logs the event identity, verb, resource and timestamps, with no request or response body attached to the event.",
    "None suppresses the event for matching resources, so nothing at all is written for those requests and the audit trail is lost."
  ],
  "q-rt-6": [
    "Audit rules are evaluated top to bottom and the first match sets the level, so the Metadata catch-all wins for Secret requests.",
    "Audit policy has no specificity ranking: it stops at the first matching rule, so a narrower rule below the catch-all is never consulted.",
    "One request produces its stage events at a single level chosen by the first matching rule, so the ordering does not duplicate events.",
    "A broad catch-all is a legal policy file, so the API server loads it and applies it as written, which keeps the ordering fault silent."
  ],
  "q-rt-7": [
    "The user block holds the authenticated principal and its group memberships, the primary link between an event and a real identity.",
    "sourceIPs records the client address the API server saw, tying an identity to a workstation, a bastion or an unexpected external source.",
    "verb plus objectRef name the action and the resource, namespace and subresource it targeted, which separates one action from another.",
    "These timestamps let you order events against other logs, and stage says which phase of the request the event describes.",
    "Audit events come from API requests handled by the API server, so they carry no container id; that data belongs to Falco or the runtime."
  ],
  "q-rt-8": [
    "jq filters audit events whose verb is create on pods and projects username, namespace and object name, giving who and where directly.",
    "Events have a short default TTL and carry no actor identity, so their reasons cannot list who created Pods or at what time.",
    "managedFields records only the last manager for each field set, so it can name a controller rather than the identity that created the Pod.",
    "The kubelet logs its own sync and container start actions on one node without caller identity, so it cannot attribute Pod creation."
  ],
  "q-rt-9": [
    "Running a shell goes through the pods/exec subresource, so the audit event records the user, sourceIPs and time of that API request.",
    "The kubelet handles the exec stream locally, but its log is per-node, usually rotated and does not record the authenticated identity.",
    "Events cover scheduling and lifecycle messages; a pods/exec call produces no durable Event naming the person who ran the shell.",
    "Container stdout captures what the process printed, not who attached, and an interactive shell may write nothing to stdout at all."
  ],
  "q-rt-10": [
    "Falco rules match syscall events such as process execution, file writes and shell spawn inside a container, so process behaviour fits it.",
    "API requests land in the audit log, and Falco k8saudit rules can consume those events to apply rules to API and user activity.",
    "The CNI datapath is where flow visibility lives, so Hubble or equivalent plus NetworkPolicy deny counters show workload-to-workload traffic.",
    "auditd watches host paths with rules in /etc/audit/rules.d and logs syscalls touching them, covering node file and process changes.",
    "kubelet events report pull failures and Pod lifecycle problems, not vulnerability data; image CVE presence is a scanner finding."
  ],
  "q-rt-11": [
    "Default-deny egress with kube-dns allowed stops exfiltration while the workload, its files and its logs remain available for inspection.",
    "Capturing logs and container files first and then scaling to zero removes the workload while keeping the evidence already collected.",
    "Cordon marks the node unschedulable without evicting Pods, so the compromised workload and its evidence stay until you capture them.",
    "Deleting Pods first destroys their filesystem and stdout evidence, and the owning controller recreates them, leaving the attacker in place.",
    "Removing the Deployment and Service deletes the entry point along with workload logs and metadata, and leaves persistence in place."
  ],
  "q-rt-12": [
    "An owning Deployment, DaemonSet or CronJob recreates a deleted Pod, and new bindings or webhooks explain how access is re-established.",
    "Garbage collection removes terminated or orphaned Pods from the API; it never creates Pods, so it cannot explain a reappearing workload.",
    "Template hash collisions decide which ReplicaSet owns Pods; they do not recreate deleted Pods, so they cannot explain reappearance.",
    "CoreDNS resolves names, and a cached record only points at an old address; it cannot make the API server create a Pod object again."
  ],
  "q-rt-13": [
    "The debug container shares host namespaces with the host root mounted at /host, so chroot /host gives genuine host ps and socket listings.",
    "A container without hostPID sees only its own process table, and a compromised Pod is attacker-controlled, so its ps output proves nothing.",
    "A Node is not a Pod, so kubectl logs has no container to read there; --previous applies only to a terminated container in a Pod.",
    "The node proxy reaches kubelet endpoints such as /pods, which report the Pod objects the kubelet manages, not host processes or sockets."
  ],
  "q-rt-14": [
    "The root filesystem mount becomes read-only, so the app can write only to paths you mounted explicitly as a volume such as emptyDir.",
    "A digest reference pins exact bytes, and IfNotPresent lets the kubelet reuse the cached copy instead of resolving a moving tag.",
    "Drop ALL capabilities, allowPrivilegeEscalation false and a numeric runAsUser block routes a running process uses to regain privilege.",
    "A shell lets someone edit a running container and drop binaries into it, the in-place tampering that immutable workloads prevent.",
    "A digest reference with imagePullPolicy Always is rejected by the API server, so the Pod never starts; digests pull as IfNotPresent."
  ],
  "q-rt-15": [
    "An emptyDir mounted at only the path the app writes keeps the root read-only and gives a scratch volume discarded when the Pod ends.",
    "Removing the control restores a writable root, so anything that lands in the container can modify binaries or add files anywhere.",
    "A writable hostPath at / gives the container the node filesystem, reintroducing the escape the read-only root was meant to prevent.",
    "Running as root changes who writes but not what is writable, and it breaks the runAsNonRoot requirement enforced by the restricted level."
  ],
  "q-rt-16": [
    "A service-account-token Secret stays valid until it is deleted, so deleting it and rotating what used it revokes the leaked bearer token.",
    "Legacy tokens are validated by signature, so with service-account-lookup off a token for a deleted ServiceAccount can still authenticate.",
    "automountServiceAccountToken only stops new mounts, so a token copied out earlier keeps working for every request it is presented with.",
    "Restarting the API server reloads configuration but does not invalidate already-issued service account tokens or the Secret holding them."
  ]
};
