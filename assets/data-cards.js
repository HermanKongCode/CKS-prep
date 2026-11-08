/*
 * CKS study deck data.
 * Classic script only: no modules, no import or export. Defines window.CKS_CARDS.
 * 91 cards, ids c-001 through c-091, grouped by domain in blueprint order.
 * Domains: cluster-setup (14), cluster-hardening (14), system-hardening (9),
 * microservices (18), supply-chain (18), runtime-security (18).
 */
window.CKS_CARDS = [

  /* cluster-setup */
  {
    id: "c-001",
    domain: "cluster-setup",
    tags: ["kubeadm", "bootstrap", "cni"],
    front: "First command that creates a kubeadm control plane, and where the kubeconfig goes after",
    back: "kubeadm init runs the control plane components as static pods. Afterwards copy /etc/kubernetes/admin.conf to ~/.kube/config as your normal user so kubectl works.",
    cmd: "kubeadm init --pod-network-cidr=10.244.0.0/16",
    why: "Nodes stay NotReady until a CNI plugin is installed, and kubectl needs admin.conf copied to a non root user."
  },
  {
    id: "c-002",
    domain: "cluster-setup",
    tags: ["kubeadm", "bootstrap", "discovery"],
    front: "Command that joins a worker to the cluster, copied from the control plane",
    back: "kubeadm join needs the API host and port, a bootstrap token, and the sha256 hash of the cluster CA public key so the worker trusts the right control plane.",
    cmd: "kubeadm join 10.0.0.10:6443 --token 7abcdef.0123456789abcdef --discovery-token-ca-cert-hash sha256:HASH",
    why: "A worker with the wrong CA hash refuses to trust your cluster and never registers."
  },
  {
    id: "c-003",
    domain: "cluster-setup",
    tags: ["kubeadm", "token", "tls"],
    front: "Commands that rebuild a lost join command for a worker",
    back: "kubeadm token create --print-join-command prints a fresh token and the whole join command. The discovery hash comes from the cluster CA public key in /etc/kubernetes/pki/ca.crt.",
    cmd: "kubeadm token create --print-join-command",
    why: "Bootstrap tokens expire after about a day, so an expired token is a common join failure."
  },
  {
    id: "c-004",
    domain: "cluster-setup",
    tags: ["kubelet", "staticpod", "kubeadm"],
    front: "Directory holding kubeadm control plane static pod manifests, and what the kubelet does there",
    back: "/etc/kubernetes/manifests. The kubelet watches that directory, so saving a new flag recreates that pod, and deleting the file removes the component entirely.",
    cmd: "ls /etc/kubernetes/manifests",
    why: "Editing the static pod manifest is the fastest way to change API server flags during the exam."
  },
  {
    id: "c-005",
    domain: "cluster-setup",
    tags: ["kubelet", "staticpod", "kubectl"],
    front: "After editing a static pod manifest, how you prove the new flag is actually running",
    back: "Read the container command list of the recreated static pod and confirm the flag appears in it. Static pods live in the kube-system namespace and are named after the node.",
    cmd: "kubectl get pod kube-apiserver-control1 -n kube-system -o jsonpath='{.spec.containers[0].command}'",
    why: "A typo in the manifest leaves the container crash looping while you believe your change applied."
  },
  {
    id: "c-006",
    domain: "cluster-setup",
    tags: ["upgrade", "kubeadm", "controlplane"],
    front: "Command that lists the upgrade targets kubeadm considers valid",
    back: "kubeadm upgrade plan shows the installed version plus the patch and minor versions it will accept, and it runs preflight checks you should read before applying anything.",
    cmd: "kubeadm upgrade plan",
    why: "Skipping the plan and its preflight messages is how control plane upgrades stall halfway through."
  },
  {
    id: "c-007",
    domain: "cluster-setup",
    tags: ["upgrade", "kubeadm", "controlplane"],
    front: "Upgrade command you run on the first control plane node only",
    back: "kubeadm upgrade apply moves the cluster to the target version on one control plane node. Use the exact version string the plan reported instead of a memorised number.",
    cmd: "kubeadm upgrade apply v1.30.0",
    why: "Only the first control plane node runs apply; the remaining control plane nodes follow it."
  },
  {
    id: "c-008",
    domain: "cluster-setup",
    tags: ["upgrade", "kubelet", "kubeadm"],
    front: "Steps to upgrade every remaining control plane node and every worker",
    back: "On each remaining control plane node and each worker run kubeadm upgrade node, then update the kubelet and kubectl packages, then restart the kubelet so it loads the new configuration.",
    cmd: "kubeadm upgrade node",
    why: "upgrade node configures the node, but the kubelet binary itself comes from the package manager."
  },
  {
    id: "c-009",
    domain: "cluster-setup",
    tags: ["kubectl", "node", "drain"],
    front: "Three kubectl commands that take a node out for maintenance and bring it back",
    back: "kubectl cordon NODE makes it Unschedulable, kubectl drain NODE --ignore-daemonsets --delete-emptydir-data evicts its workloads, and kubectl uncordon NODE resumes scheduling.",
    cmd: "kubectl drain NODE --ignore-daemonsets --delete-emptydir-data",
    why: "Draining before patching avoids pods stuck on a node that is frozen mid upgrade."
  },
  {
    id: "c-010",
    domain: "cluster-setup",
    tags: ["upgrade", "version", "kubelet"],
    front: "Version skew rule that decides the order of a cluster upgrade",
    back: "Upgrade the control plane first, because a kubelet must never be newer than kube-apiserver. Confirm the skew your versions allow with kubectl version before you start.",
    cmd: "kubectl get nodes -o wide",
    why: "Skew problems appear as unsupported API version errors on nodes right after a control plane patch."
  },
  {
    id: "c-011",
    domain: "cluster-setup",
    tags: ["kubectl", "taint", "controlplane"],
    front: "Command that removes the control plane NoSchedule taint, and when you should do it",
    back: "kubectl taint nodes NODE node-role.kubernetes.io/control-plane:NoSchedule- removes the taint. Older clusters use the master taint name, so read the current taints first.",
    cmd: "kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints",
    why: "Scheduling ordinary workloads onto a control plane widens the blast radius of a small compromise."
  },
  {
    id: "c-012",
    domain: "cluster-setup",
    tags: ["certs", "kubeadm", "etcd"],
    front: "Command that shows whether cluster certificates are about to expire",
    back: "kubeadm certs check-expiration lists each certificate and its expiry date. Renew with kubeadm certs renew all, then restart the static pod components so they load the new files.",
    cmd: "kubeadm certs check-expiration",
    why: "Expired etcd or front proxy certificates take the whole cluster down at the same moment."
  },
  {
    id: "c-013",
    domain: "cluster-setup",
    tags: ["etcd", "etcdctl", "tls"],
    front: "How you read etcd on a kubeadm control plane node as root",
    back: "etcd runs as a static pod with TLS and client authentication, so etcdctl must present the CA file plus a client certificate and key from /etc/kubernetes/pki/etcd.",
    cmd: "ETCDCTL_API=3 etcdctl --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt --key=/etc/kubernetes/pki/etcd/healthcheck-client.key get /registry --prefix --keys-only",
    why: "Almost every etcd task in the exam needs those three certificate flags to return anything."
  },
  {
    id: "c-014",
    domain: "cluster-setup",
    tags: ["kubeadm", "certs", "controlplane"],
    front: "How a second control plane node joins with the same certificates",
    back: "Upload control plane certificates to obtain a certificate key, then kubeadm join with --control-plane and that key. The certificate key is short lived and must be regenerated when it expires.",
    cmd: "kubeadm init phase upload-certs --upload-certs",
    why: "Without --control-plane the join command quietly produces another worker node."
  },

  /* cluster-hardening */
  {
    id: "c-015",
    domain: "cluster-hardening",
    tags: ["apiserver", "authn", "flag"],
    front: "Flag that blocks unauthenticated requests at the API server, and how to test it",
    back: "Set --anonymous-auth=false in the kube-apiserver static pod manifest. With it set, a request with no credentials is refused because anonymous authentication is disabled.",
    cmd: "curl -k -s https://127.0.0.1:6443/version",
    why: "Anonymous access maps callers to system:anonymous, which clusters frequently grant far too much."
  },
  {
    id: "c-016",
    domain: "cluster-hardening",
    tags: ["apiserver", "rbac", "flag"],
    front: "Value of --authorization-mode on a hardened kubeadm cluster and why the order matters",
    back: "Node,RBAC. The API server consults the authorization modes in the order written, so Node stays first to let each kubelet reach its own node and pod resources before RBAC is evaluated.",
    cmd: "grep authorization-mode /etc/kubernetes/manifests/kube-apiserver.yaml",
    why: "Dropping the Node mode breaks kubelet certificate requests and node reads across the cluster."
  },
  {
    id: "c-017",
    domain: "cluster-hardening",
    tags: ["admission", "node", "kubelet"],
    front: "Admission plugin that limits what a kubelet is allowed to change in the cluster",
    back: "NodeRestriction. A kubelet may write only its own Node object and the Pods assigned to it, and it cannot relabel other nodes or delete objects outside its own identity.",
    cmd: "grep enable-admission-plugins /etc/kubernetes/manifests/kube-apiserver.yaml",
    why: "Without NodeRestriction a compromised kubelet can relabel or evict other nodes in the cluster."
  },
  {
    id: "c-018",
    domain: "cluster-hardening",
    tags: ["admission", "apiserver", "flag"],
    front: "Trap to avoid when you write --enable-admission-plugins by hand",
    back: "An explicit list replaces the whole default plugin list rather than adding to it, so restate every plugin you depend on, NodeRestriction included.",
    cmd: "kubectl get pod kube-apiserver-control1 -n kube-system -o jsonpath='{.spec.containers[0].command}'",
    why: "Silently losing a default admission plugin is a hardening gap an auditor can see immediately."
  },
  {
    id: "c-019",
    domain: "cluster-hardening",
    tags: ["serviceaccount", "apiserver", "token"],
    front: "Flag that makes service account tokens validate against service account objects",
    back: "--service-account-lookup=true on kube-apiserver. It verifies that the service account named in a token still exists, so a token for a deleted account stops authenticating.",
    cmd: "grep service-account-lookup /etc/kubernetes/manifests/kube-apiserver.yaml",
    why: "Without lookup, a leaked token keeps working even after you delete the account it belongs to."
  },
  {
    id: "c-020",
    domain: "cluster-hardening",
    tags: ["etcd", "tls", "flag"],
    front: "Etcd flags that force every client to present a certificate",
    back: "etcd --client-cert-auth with --trusted-ca-file, plus its serving --cert-file and --key-file. The API server then supplies its own etcd client certificate for mutual TLS.",
    cmd: "grep -E 'client-cert-auth|trusted-ca-file' /etc/kubernetes/manifests/etcd.yaml",
    why: "Etcd holds every object in the cluster, so an endpoint that accepts unauthenticated reads is a full cluster compromise."
  },
  {
    id: "c-021",
    domain: "cluster-hardening",
    tags: ["rbac", "verb", "authorization"],
    front: "Two RBAC verbs that let a user hand out permissions they may not hold",
    back: "bind lets a subject create a binding that references a role it does not have, and escalate lets it grant more privileges than it holds itself. Keep both with cluster administrators.",
    cmd: "kubectl auth can-i create clusterrolebindings",
    why: "If ordinary users hold bind, RBAC becomes self escalating and least privilege stops meaning anything."
  },
  {
    id: "c-022",
    domain: "cluster-hardening",
    tags: ["rbac", "serviceaccount", "kubectl"],
    front: "Command that lists every permission a service account really has",
    back: "kubectl auth can-i --list while impersonating the service account identity. It prints the verbs, resources and scope that the workload actually receives from its bindings.",
    cmd: "kubectl auth can-i --list --as=system:serviceaccount:team-a:builder",
    why: "Auditing the workload identity directly is faster than reading binding files one by one."
  },
  {
    id: "c-023",
    domain: "cluster-hardening",
    tags: ["rbac", "role", "clusterrole"],
    front: "Role versus ClusterRole binding, and the scope mistake people keep making",
    back: "A RoleBinding grants its role inside one namespace only. A ClusterRole used by a RoleBinding stays namespace limited, while a ClusterRoleBinding grants that same role cluster wide.",
    cmd: "kubectl get rolebindings,clusterrolebindings -A",
    why: "Using a ClusterRoleBinding where a RoleBinding was intended is the most common over privilege finding."
  },
  {
    id: "c-024",
    domain: "cluster-hardening",
    tags: ["serviceaccount", "projected", "token"],
    front: "How to give a pod a short lived service account token bound to one audience",
    back: "Add a projected volume with a serviceAccountToken source, set audience to the receiving service and expirationSeconds for the lifetime you want. Confirm the exact field nesting with kubectl explain.",
    cmd: "kubectl explain pod.spec.volumes.projected.sources.serviceAccountToken",
    why: "Audience bound short lived tokens stop working elsewhere, so a leak costs you far less."
  },
  {
    id: "c-025",
    domain: "cluster-hardening",
    tags: ["serviceaccount", "token", "kubectl"],
    front: "Command that mints a short lived service account token from the CLI",
    back: "kubectl create token with --durationSeconds and --audience produces a projected token for a job or a test. On clusters that do not have the subcommand, use a projected volume instead.",
    cmd: "kubectl create token builder -n team-a --durationSeconds=3600 --audience=https://internal.example",
    why: "Minting a one hour token beats handing out a Secret token that never expires."
  },
  {
    id: "c-026",
    domain: "cluster-hardening",
    tags: ["serviceaccount", "pod", "hardening"],
    front: "Two places to set automountServiceAccountToken false, and which one wins",
    back: "On the ServiceAccount object, and in the Pod spec. The pod level value overrides the service account value, so a single pod can still opt back in to receiving a token.",
    cmd: "kubectl patch serviceaccount builder -n team-a -p '{\"automountServiceAccountToken\":false}'",
    why: "Workloads that never call the API should not carry a cluster credential in their filesystem."
  },
  {
    id: "c-027",
    domain: "cluster-hardening",
    tags: ["serviceaccount", "secret", "token"],
    front: "How a legacy service account token Secret is created, and why to replace it",
    back: "A Secret of type kubernetes.io/service-account-token annotated with the target service account name. Those tokens do not rotate, are not audience bound, and can outlive the account itself.",
    cmd: "kubectl get secrets -A -o custom-columns=NAME:.metadata.name,TYPE:.type",
    why: "Legacy token Secrets are long lived credentials that quietly survive every rotation policy."
  },
  {
    id: "c-028",
    domain: "cluster-hardening",
    tags: ["kubelet", "hardening", "authz"],
    front: "Three kubelet settings that close its unauthenticated endpoints",
    back: "readOnlyPort must be 0, anonymous authentication must be disabled, and authorization mode must be Webhook so the API server authorizes kubelet requests. Restart the kubelet after editing.",
    cmd: "grep -nE 'readOnlyPort|anonymous|authorization' /var/lib/kubelet/config.yaml",
    why: "An open read only port or an anonymous 10250 endpoint is a direct path onto the node."
  },

  /* system-hardening */
  {
    id: "c-029",
    domain: "system-hardening",
    tags: ["cis", "kube-bench", "hardening"],
    front: "Command that runs CIS benchmark checks on a control plane node",
    back: "kube-bench runs the CIS Kubernetes Benchmark checks for your cluster version and reports each check as pass, info or fail with a short description. Pick the target that matches the node role.",
    cmd: "kube-bench run --target master",
    why: "kube-bench output is how you find hardening gaps instead of memorising control numbers."
  },
  {
    id: "c-030",
    domain: "system-hardening",
    tags: ["cis", "kube-bench", "remediation"],
    front: "A kube-bench check fails. What do you change, and how do you confirm the fix",
    back: "Read the failing check text and its audit output, fix the exact file mode, ownership or API server flag that it names, then run kube-bench again and compare the pass and fail counts.",
    cmd: "kube-bench run --target master | grep -i FAIL",
    why: "The audit line shows the real file state, which is the shortest path to the correct remediation."
  },
  {
    id: "c-031",
    domain: "system-hardening",
    tags: ["cis", "kubelet", "credential"],
    front: "Which node files do you inspect when kube-bench reports permission problems",
    back: "The admin, kubelet, controller manager and scheduler kubeconfigs under /etc/kubernetes, plus the kubelet client files under /var/lib/kubelet. Tighten them to owner root and mode 600.",
    cmd: "ls -l /etc/kubernetes/*.conf",
    why: "Those files authenticate as cluster administrators or as the kubelet, so loose modes are a credential leak."
  },
  {
    id: "c-032",
    domain: "system-hardening",
    tags: ["metadata", "egress", "iam"],
    front: "How you stop a pod from stealing node cloud credentials from the metadata endpoint",
    back: "Apply default deny egress in every namespace, then allow only what you need and exclude the link local range 169.254.169.254/32 with ipBlock except. On the node, require the metadata service to demand a session token.",
    cmd: "kubectl run meta-test --rm -it --image=curlimages/curl --command -- curl --max-time 3 169.254.169.254/latest/meta-data/",
    why: "The metadata endpoint hands out node instance role credentials to anything that can reach the node network."
  },
  {
    id: "c-033",
    domain: "system-hardening",
    tags: ["supplychain", "checksum", "binary"],
    front: "How you verify a downloaded cluster binary before you install it on a node",
    back: "Compare the file against the published checksum, for example with sha256sum, and check a signature where the vendor publishes one. Prefer a distribution repository over ad hoc downloads.",
    cmd: "sha256sum kubectl",
    why: "A tampered kubelet or kubeadm binary gives node level access before the cluster even starts."
  },
  {
    id: "c-034",
    domain: "system-hardening",
    tags: ["hostos", "minimal", "hardening"],
    front: "What should stay on a worker node operating system image",
    back: "Only the container runtime, the kubelet, and what the runtime needs. Remove compilers, debug shells, package managers, ssh servers and any service the node does not need in order to run pods.",
    cmd: "systemctl list-units --type=service --state=running",
    why: "Every binary you leave on a node is a tool for whoever lands there after a container escape."
  },
  {
    id: "c-035",
    domain: "system-hardening",
    tags: ["iam", "leastprivilege", "ci"],
    front: "How node instance roles and CI runner credentials should be scoped",
    back: "Node roles carry only what the kubelet genuinely needs, never cluster administrative rights. CI should use short lived scoped credentials rather than a committed kubeconfig with broad access.",
    cmd: "kubectl auth can-i --list --as=system:node:ip-10-0-0-11",
    why: "Node identity is the broadest credential on a cluster, and CI systems leak it more often than anything else."
  },
  {
    id: "c-036",
    domain: "system-hardening",
    tags: ["apparmor", "node", "cis"],
    front: "Where AppArmor profiles live on a node, and how you load one without a reboot",
    back: "Profile files live in /etc/apparmor.d. Load or reload a profile with apparmor_parser -r, then confirm with aa-status which profiles are in enforce mode and which are only in complain mode.",
    cmd: "apparmor_parser -r /etc/apparmor.d/app_nginx",
    why: "A profile that is not loaded, or is only in complain mode, records violations but blocks nothing."
  },
  {
    id: "c-037",
    domain: "system-hardening",
    tags: ["apparmor", "pod", "securitycontext"],
    front: "Current way to pin an AppArmor profile to a Pod, and what the old annotations were",
    back: "securityContext.appArmorProfile with type Localhost and the profile name, and that profile must already exist on the node you schedule to. Older clusters used AppArmor pod annotations, so confirm which your cluster accepts.",
    cmd: "kubectl explain pod.spec.securityContext.appArmorProfile",
    why: "AppArmor you cannot demonstrate to an auditor is a hardening claim rather than a control."
  },

  /* microservices */
  {
    id: "c-038",
    domain: "microservices",
    tags: ["networkpolicy", "default-deny", "ingress"],
    front: "NetworkPolicy that blocks all inbound traffic to a namespace",
    back: "A policy whose podSelector is empty selects every pod in that namespace, and policyTypes containing Ingress with no ingress rules allows nothing back. Traffic between pods in the namespace is denied too.",
    cmd: "kubectl apply -f netpol-default-deny-ingress.yaml",
    why: "Namespaces start wide open, so default deny is the baseline every other rule is written against."
  },
  {
    id: "c-039",
    domain: "microservices",
    tags: ["networkpolicy", "egress", "default-deny"],
    front: "NetworkPolicy that stops a pod reaching anything outside the cluster",
    back: "A policy with an empty podSelector and policyTypes containing Egress but no egress rules denies all outbound traffic, external addresses included. Add an explicit rule for your DNS servers on port 53 over UDP.",
    cmd: "kubectl apply -f netpol-default-deny-egress.yaml",
    why: "Deny all egress is how you cut command and control callbacks out of a compromised workload."
  },
  {
    id: "c-040",
    domain: "microservices",
    tags: ["networkpolicy", "selector", "ports"],
    front: "Rule that lets only labelled pods in the same namespace reach an app on one port",
    back: "An ingress rule whose from entry uses podSelector matchLabels, plus a ports list naming the protocol and port. If you leave ports out, every port is allowed for the matched source pods.",
    cmd: "kubectl get networkpolicy -A",
    why: "Omitting the ports field is the usual reason a policy works but still permits far too much."
  },
  {
    id: "c-041",
    domain: "microservices",
    tags: ["networkpolicy", "namespace", "selector"],
    front: "How a from entry using namespaceSelector behaves, and how it combines with podSelector",
    back: "namespaceSelector matchLabels on its own admits any pod in a matching namespace. When podSelector and namespaceSelector appear in the same from entry it is an AND: that pod, in that namespace.",
    cmd: "kubectl get ns --show-labels",
    why: "A namespace wide grant looks precise but also admits every workload created there later."
  },
  {
    id: "c-042",
    domain: "microservices",
    tags: ["networkpolicy", "ipblock", "egress"],
    front: "How you let a pod reach the internet while blocking your private network ranges",
    back: "An egress rule with ipBlock cidr 0.0.0.0/0 and except entries for your internal ranges. ipBlock cannot be combined with podSelector or namespaceSelector inside the same from or to entry.",
    cmd: "kubectl get networkpolicy app-egress -o yaml",
    why: "Without except, the same rule that opens the internet also opens the node network and internal services."
  },
  {
    id: "c-043",
    domain: "microservices",
    tags: ["networkpolicy", "selector", "coverage"],
    front: "A NetworkPolicy exists in a namespace, yet some pods there are still unrestricted",
    back: "A pod is filtered only if the podSelector of some policy in its namespace selects it. Pods matched by no policy at all keep the unrestricted default behaviour.",
    cmd: "kubectl get networkpolicy -n team-a -o custom-columns=NAME:.metadata.name,SELECTOR:.spec.podSelector",
    why: "Partial coverage stays invisible until someone probes an unpicked pod and reaches it."
  },
  {
    id: "c-044",
    domain: "microservices",
    tags: ["networkpolicy", "cni"],
    front: "A NetworkPolicy is applied and correct, but the traffic still flows",
    back: "Check whether the installed CNI plugin enforces NetworkPolicy at all. Only some plugins implement the policy API, so confirm CNI support before you rewrite the policy.",
    cmd: "kubectl get pods -n kube-system",
    why: "A policy no CNI enforces is stored configuration, not a control you can depend on."
  },
  {
    id: "c-045",
    domain: "microservices",
    tags: ["networkpolicy", "testing", "debug"],
    front: "How you verify a NetworkPolicy from inside the cluster instead of trusting the manifest",
    back: "Run a throwaway pod carrying basic network tools and probe the target service address and port from inside the cluster, ideally once from a selected namespace and once from an unselected one.",
    cmd: "kubectl run netprobe --rm -it --image=busybox --command -- nc -zv -w 3 TARGET_SERVICE 80",
    why: "A real probe catches the case where the YAML is valid but selects the wrong pods."
  },
  {
    id: "c-046",
    domain: "microservices",
    tags: ["ingress", "tls", "secret"],
    front: "How you put TLS on an HTTP Ingress route, and which Secret type it needs",
    back: "Create a Secret of type kubernetes.io/tls holding tls.crt and tls.key, then add a tls section to the Ingress with hosts and secretName. Confirm the field names with kubectl explain ingress.",
    cmd: "kubectl create secret tls app-tls --cert=tls.crt --key=tls.key",
    why: "With no tls section the controller serves its default certificate and your application traffic stays cleartext."
  },
  {
    id: "c-047",
    domain: "microservices",
    tags: ["psa", "namespace", "label"],
    front: "The three Pod Security Admission modes you label a namespace with",
    back: "pod-security.kubernetes.io/enforce, audit and warn on the namespace object. enforce rejects the request, audit records violations in the API server log, warn only warns the client that it would fail.",
    cmd: "kubectl label namespace team-a pod-security.kubernetes.io/enforce=restricted --overwrite",
    why: "Enforcing restricted on a live namespace without audit first is how a rollout suddenly stops accepting pods."
  },
  {
    id: "c-048",
    domain: "microservices",
    tags: ["psa", "enforce", "pod"],
    front: "You enforce restricted on a namespace. What happens to the pods already running there",
    back: "Nothing, because enforce only evaluates new requests. Existing pods keep running until they are recreated, so roll the workloads or delete the offending pods to make the namespace compliant.",
    cmd: "kubectl rollout restart deployment -n team-a",
    why: "A namespace can read as enforced while non compliant pods keep running inside it."
  },
  {
    id: "c-049",
    domain: "microservices",
    tags: ["psa", "baseline", "restricted"],
    front: "Difference between the baseline and restricted Pod Security Standards",
    back: "baseline blocks obvious host access such as host namespaces and hostPath volumes for workloads that are not trying to escape. restricted adds hardening against privilege and abuse, including non root identity, seccomp, dropped capabilities and no privilege escalation.",
    cmd: "kubectl explain pod.spec.securityContext",
    why: "Choosing baseline when restricted is required is a finding you will be asked about directly."
  },
  {
    id: "c-050",
    domain: "microservices",
    tags: ["seccomp", "securitycontext", "localhost"],
    front: "Two ways to get a seccomp profile onto a Pod, and when you pick each one",
    back: "securityContext.seccompProfile type RuntimeDefault uses the container runtime default profile, which is the usual first layer. type Localhost points at a profile file that already exists on the nodes you schedule to.",
    cmd: "kubectl explain pod.spec.securityContext.seccompProfile",
    why: "RuntimeDefault blocks risky syscalls with no profile work, so it is the cheap win to take first."
  },
  {
    id: "c-051",
    domain: "microservices",
    tags: ["admission", "kyverno", "gatekeeper"],
    front: "Kyverno versus Gatekeeper, and the field that decides whether a policy actually blocks",
    back: "Kyverno policies are YAML and use validationFailureAction, where Audit records the failure and Enforce rejects the request. Gatekeeper enforces policies written in Rego through constraint templates. Confirm field placement for your version.",
    cmd: "kubectl get clusterpolicies.kyverno.io",
    why: "Audit mode gives you findings without breaking workloads, which is how you move to Enforce safely."
  },
  {
    id: "c-052",
    domain: "microservices",
    tags: ["istio", "mtls", "peerauthentication"],
    front: "Istio setting that requires mTLS on the server side for a namespace",
    back: "A PeerAuthentication resource with mtls mode STRICT, mesh wide when written in the Istio root namespace and per namespace otherwise. STRICT makes the sidecar refuse plaintext connections. If the short name is missing, query the full security.istio.io resource.",
    cmd: "kubectl get peerauthenticators -A",
    why: "Server side enforcement is what turns mesh encryption from a suggestion into a requirement."
  },
  {
    id: "c-053",
    domain: "microservices",
    tags: ["istio", "mtls", "destinationrule"],
    front: "Istio resource that makes the client side of a mesh call use mTLS",
    back: "A DestinationRule with trafficPolicy tls mode ISTIO_MUTUAL, which uses the sidecar certificates for that connection. PeerAuthentication governs how a workload accepts traffic, a DestinationRule governs how traffic is sent.",
    cmd: "kubectl get destinationrules -A",
    why: "Enforcing only one side leaves clients able to reach a plaintext port that still exists."
  },
  {
    id: "c-054",
    domain: "microservices",
    tags: ["istio", "sidecar", "label"],
    front: "Two ways to get an Envoy sidecar injected, and how you verify it landed",
    back: "Label the namespace with istio-injection enabled, or annotate one Pod with the inject annotation. Confirm by listing the container names of the created pod and looking for the proxy container.",
    cmd: "kubectl get pod APPPOD -o jsonpath='{.spec.containers[*].name}'",
    why: "A missing sidecar silently disables mesh encryption, retries and policy for that workload."
  },
  {
    id: "c-055",
    domain: "microservices",
    tags: ["multitenancy", "rbac", "quota"],
    front: "The isolation layers you stack to keep two teams on one cluster apart",
    back: "Separate namespaces, namespaced RoleBindings instead of cluster wide grants, ResourceQuota and LimitRange for capacity, NetworkPolicy for pod to pod traffic, and Pod Security Admission labels for what may run.",
    cmd: "kubectl get resourcequota,limitrange,networkpolicy -n team-a",
    why: "Any single layer can be routed around, so tenancy safety comes from having all of them at once."
  },

  /* supply-chain */
  {
    id: "c-056",
    domain: "supply-chain",
    tags: ["image", "distroless", "minimal"],
    front: "Distroless base image variants, and what you give up by using them",
    back: "static for a minimal compiled runtime, base for a language runtime, cc when a build needs toolchain pieces, and nonroot so the image can run as a user instead of root. scratch has no operating system at all. None of them give you a shell or a package manager.",
    cmd: "grep -n FROM Dockerfile",
    why: "Fewer binaries means less to abuse inside a container, but all debugging must happen from outside it."
  },
  {
    id: "c-057",
    domain: "supply-chain",
    tags: ["image", "digest", "immutability"],
    front: "How you make an image reference immutable in a Pod spec",
    back: "Reference the image by digest rather than by tag, and set imagePullPolicy IfNotPresent so the same content is used even if that tag is republished somewhere else.",
    cmd: "kubectl get pods -A -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image",
    why: "A tag can be repointed to different content, so tag based deployments are not reproducible."
  },
  {
    id: "c-058",
    domain: "supply-chain",
    tags: ["immutability", "securitycontext", "volume"],
    front: "Field that makes a container root filesystem immutable, and where writable state goes",
    back: "securityContext readOnlyRootFilesystem set to true, then mount an emptyDir or a persistent volume claim at each path the application must write to, such as a temporary directory.",
    cmd: "kubectl explain pod.spec.containers.securityContext.readOnlyRootFilesystem",
    why: "An immutable root filesystem removes the drop a file and keep it there place for an attacker."
  },
  {
    id: "c-059",
    domain: "supply-chain",
    tags: ["capabilities", "securitycontext", "leastprivilege"],
    front: "Capability pattern that removes everything and re-adds only what the application needs",
    back: "capabilities drop ALL inside securityContext, then add back only the one capability required, for example NET_BIND_SERVICE. Do not solve a capability problem by setting privileged to true.",
    cmd: "kubectl explain pod.spec.containers.securityContext.capabilities",
    why: "The default capability set is broader than most applications use, and each extra capability is escalation surface."
  },
  {
    id: "c-060",
    domain: "supply-chain",
    tags: ["securitycontext", "nonroot", "restricted"],
    front: "Two securityContext fields that stop setuid style escalation and a root identity",
    back: "allowPrivilegeEscalation false blocks setuid and similar escalation, and runAsNonRoot true forces a non zero user id, which the image USER directive or an explicit runAsUser must satisfy.",
    cmd: "kubectl explain pod.spec.containers.securityContext.runAsNonRoot",
    why: "These are the fields the restricted standard checks, so a namespace cannot pass restricted without them."
  },
  {
    id: "c-061",
    domain: "supply-chain",
    tags: ["sbom", "supplychain", "inventory"],
    front: "What an SBOM contains, and what it deliberately does not tell you",
    back: "An SBOM is a machine readable inventory of packages, versions, licences and suppliers in a built artifact, sometimes with digests. It is not a vulnerability report, so it must be matched against a vulnerability database to be actionable.",
    cmd: "syft IMAGE -o table",
    why: "The SBOM is what lets you answer a disclosure quickly: do you ship the affected package or not."
  },
  {
    id: "c-062",
    domain: "supply-chain",
    tags: ["cosign", "signature", "keyless"],
    front: "cosign command that signs an image keyless, and what you point it at",
    back: "cosign sign against the digest reference. Keyless signing uses your OIDC identity to issue a short lived certificate, so the signature records who built the image and from which repository.",
    cmd: "cosign sign --yes IMAGE@sha256:DIGEST",
    why: "Signing during the build is what lets a cluster verify provenance instead of trusting a registry name."
  },
  {
    id: "c-063",
    domain: "supply-chain",
    tags: ["cosign", "verify", "identity"],
    front: "cosign verify flags that make a signature mean something to your cluster",
    back: "Pin --certificate-identity-regexp to your own repository identity and --certificate-oidc-issuer to your issuer, quoting the pattern so the shell does not expand it. A bare verify accepts any certificate your trust list signed.",
    cmd: "cosign verify --certificate-identity-regexp 'https://github.com/ORG/REPO$' --certificate-oidc-issuer https://token.actions.githubusercontent.com IMAGE@sha256:DIGEST",
    why: "Without identity and issuer pinned, any signed image from any source passes your admission check."
  },
  {
    id: "c-064",
    domain: "supply-chain",
    tags: ["cosign", "digest", "tag"],
    front: "Why you sign and verify the digest reference instead of the tag",
    back: "A tag can be moved to different content, so a signature attached to a tag can stay valid while the deployed image changed. The digest is the content address, so verification and execution refer to the same bytes.",
    cmd: "kubectl get pod APPPOD -o jsonpath='{.status.containerStatuses[0].imageID}'",
    why: "Comparing the running imageID with the signed digest proves the running bytes are the signed bytes."
  },
  {
    id: "c-065",
    domain: "supply-chain",
    tags: ["trivy", "scan", "gate"],
    front: "Trivy flags that turn an image scan into a blocking pipeline gate",
    back: "Use --severity to choose which levels count, --exit-code 1 so findings fail the build, and --ignore-unfixed to skip issues that have no fixed release yet. A scan without a failing exit code is documentation.",
    cmd: "trivy image --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 IMAGE",
    why: "A gate that cannot fail is not a control, it is a report that nobody acts on."
  },
  {
    id: "c-066",
    domain: "supply-chain",
    tags: ["secret", "csi", "externalstore"],
    front: "Two patterns for keeping real secret values out of the cluster while apps still read them",
    back: "Sync values from an external secret store into Kubernetes Secrets on a schedule, or mount them into the container through an external secret store CSI driver volume. Both keep long lived values out of etcd backups and CI logs.",
    cmd: "kubectl explain pod.spec.volumes.csi.volumeAttributes",
    why: "External storage limits exposure to one workload and node instead of the whole control plane."
  },
  {
    id: "c-067",
    domain: "supply-chain",
    tags: ["image", "secret", "serviceaccount"],
    front: "Where private registry credentials belong when many pods in a namespace pull from it",
    back: "A docker registry Secret referenced by imagePullSecrets on the ServiceAccount the pods use. A pod that sets serviceAccountName must point at a service account that carries the pull secret.",
    cmd: "kubectl create secret docker-registry regcred --docker-server=REGISTRY --docker-username=USER --docker-password=PASSWORD",
    why: "Service account level pull credentials beat repeating imagePullSecrets in every Pod manifest."
  },
  {
    id: "c-068",
    domain: "supply-chain",
    tags: ["image", "secret", "namespace"],
    front: "Which namespace an imagePullSecret has to live in",
    back: "The same namespace as the pod and as the service account that references it. Secrets are not resolved across namespaces, so create or sync the pull secret in every namespace that pulls from the private registry.",
    cmd: "kubectl patch serviceaccount default -p '{\"imagePullSecrets\":[{\"name\":\"regcred\"}]}'",
    why: "ErrImagePull with valid credentials almost always means the secret sits in the wrong namespace."
  },
  {
    id: "c-069",
    domain: "supply-chain",
    tags: ["encryption", "apiserver", "flag"],
    front: "Flag that enables encryption at rest, and what kind of file it points to",
    back: "kube-apiserver --encryption-provider-config points at an EncryptionConfiguration file that lists the resources to protect and the providers in priority order. Confirm the apiVersion your cluster version expects.",
    cmd: "grep encryption-provider-config /etc/kubernetes/manifests/kube-apiserver.yaml",
    why: "With no provider configured, secrets in etcd are base64 encoded, which is encoding and not encryption."
  },
  {
    id: "c-070",
    domain: "supply-chain",
    tags: ["encryption", "provider", "order"],
    front: "How the provider list in an EncryptionConfiguration behaves on writes and on reads",
    back: "The first provider in the list encrypts new writes, while every provider listed is tried when decrypting stored data. That asymmetry is what makes a staged key migration possible without downtime.",
    cmd: "grep -A 16 'providers:' /etc/kubernetes/encryptionconfig.yaml",
    why: "Reads consult every listed provider, so removing one too early makes existing objects unreadable."
  },
  {
    id: "c-071",
    domain: "supply-chain",
    tags: ["encryption", "rewrite", "secret"],
    front: "You made a new encryption key primary. What rewrites the objects already stored in etcd",
    back: "Nothing rewrites by itself. Re-apply the affected objects, for example read all secrets as yaml and pipe them back through kubectl apply, and clear resourceVersion or use a raw replace if the API reports conflicts.",
    cmd: "kubectl get secrets -A -o yaml | kubectl apply -f -",
    why: "Etcd stores what the API server last wrote, so old ciphertext survives until each object is touched."
  },
  {
    id: "c-072",
    domain: "supply-chain",
    tags: ["encryption", "rotation", "order"],
    front: "Safe order for rotating an encryption key in the provider list",
    back: "Append the new key, then move it to the primary position so new writes use it, then rewrite the affected objects, and only after that delete the old key from the list and restart the API server.",
    cmd: "grep -n 'aescbc' /etc/kubernetes/encryptionconfig.yaml",
    why: "Dropping the old key before the rewrite leaves objects that no remaining provider can decrypt."
  },
  {
    id: "c-073",
    domain: "supply-chain",
    tags: ["etcd", "encryption", "verification"],
    front: "Command that proves a secret is stored as ciphertext in etcd",
    back: "Read the secret key path directly from etcd with etcdctl and its client certificates, then compare the stored bytes against the readable value kubectl shows you for the same object.",
    cmd: "ETCDCTL_API=3 etcdctl --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt --key=/etc/kubernetes/pki/etcd/healthcheck-client.key get /registry/secrets/team-a/app-token --print-value-only",
    why: "Etcd is the ground truth for whether your provider configuration is doing anything at all."
  },

  /* runtime-security */
  {
    id: "c-074",
    domain: "runtime-security",
    tags: ["falco", "daemonset", "coverage"],
    front: "How Falco gets node visibility on every worker, and how you confirm that coverage",
    back: "Falco is deployed as a DaemonSet so one instance inspects kernel and container events on each node. Confirm a ready Falco pod exists on every node before you trust any detection output.",
    cmd: "kubectl get daemonset -n falco",
    why: "A node with no Falco pod emits no syscall alerts, and that gap looks exactly like a clean cluster."
  },
  {
    id: "c-075",
    domain: "runtime-security",
    tags: ["falco", "ebpf", "driver"],
    front: "Falco driver you choose when you cannot build a kernel module on the nodes",
    back: "The modern eBPF probe driver, which needs no kernel headers and no module compilation and works across a wider kernel range than the kernel module driver. Confirm the option name with falco --help on the node.",
    cmd: "falco --help | grep -i driver",
    why: "A driver that fails to build on one node class quietly stops detection for that whole node pool."
  },
  {
    id: "c-076",
    domain: "runtime-security",
    tags: ["falco", "rules", "tuning"],
    front: "Where you add custom Falco rules without editing the stock rule file",
    back: "falco_rules.local.yaml is read after falco_rules.yaml, so your new rules are appended and a rule written with a stock name replaces that stock rule. Use append semantics to extend a rule instead of replacing it.",
    cmd: "grep -n 'append:' /etc/falco/falco_rules.local.yaml",
    why: "Edits made in the stock file are lost on the next upgrade and leave a ruleset you cannot diff."
  },
  {
    id: "c-077",
    domain: "runtime-security",
    tags: ["falco", "validate", "rules"],
    front: "Command that checks a Falco rules file before you ship it to nodes",
    back: "falco --validate parses the rules and reports syntax, macro and condition errors without running detection. Validate the base file and your local additions separately, then together.",
    cmd: "falco --validate falco_rules.local.yaml",
    why: "One broken rules file can stop Falco on every node at once through the DaemonSet rollout."
  },
  {
    id: "c-078",
    domain: "runtime-security",
    tags: ["falco", "fields", "rule"],
    front: "Falco fields that name the process, the image and the workload behind an alert",
    back: "proc.cmdline and proc.pname for the process, container.image.repository and container.image.tag for the image, and k8s.pod.name with k8s.ns.name for the workload. Container and Kubernetes fields are empty for host events.",
    cmd: "grep -n 'proc.cmdline' /etc/falco/falco_rules.yaml",
    why: "An alert that only says a shell ran is untriageable; the image and namespace tell you whom to call."
  },
  {
    id: "c-079",
    domain: "runtime-security",
    tags: ["falco", "tuning", "noise"],
    front: "How you cut Falco noise while keeping coverage of real abuse",
    back: "Narrow the conditions, add exceptions by image or process name, keep your changes as local rule overrides instead of deleting stock rules, and keep priorities and outputs readable. Confirm tuning options with falco --help.",
    cmd: "grep -c 'priority: critical' /etc/falco/falco_rules.local.yaml",
    why: "Falco that pages you for every package install gets muted by the on call, which is worse than no detection."
  },
  {
    id: "c-080",
    domain: "runtime-security",
    tags: ["audit", "policy", "level"],
    front: "Audit policy levels, and the ordering rule that decides which one applies",
    back: "None, Metadata, Request and RequestResponse say how much of an event is recorded. Rules match from the top down and only the first match applies, so narrow rules must sit above the broad catch all rule.",
    cmd: "grep -n 'level:' /etc/kubernetes/audit-policy.yaml",
    why: "A broad rule written first silently swallows every detailed rule underneath it."
  },
  {
    id: "c-081",
    domain: "runtime-security",
    tags: ["audit", "apiserver", "flag"],
    front: "API server flags that turn audit logging on",
    back: "Point --audit-policy-file at the policy file, set --audit-log-path for the JSON event log, and cap the log with maximum file size and backup file limits so it cannot fill the node disk.",
    cmd: "grep -E 'audit-policy-file|audit-log-path' /etc/kubernetes/manifests/kube-apiserver.yaml",
    why: "Without a path and size limits an audit log becomes a disk filling denial of service on the control plane."
  },
  {
    id: "c-082",
    domain: "runtime-security",
    tags: ["audit", "attribution", "fields"],
    front: "Fields in an audit event that answer who acted and from where",
    back: "user.username and user.groups, sourceIPs, userAgent and the request timestamp, the verb, objectRef resource, subresource and name, and responseCode to show whether the request was allowed.",
    cmd: "jq '.user.username' /var/log/kubernetes/audit.log | sort -u",
    why: "Attribution is what turns a suspicious change into an account and a source address you can act on."
  },
  {
    id: "c-083",
    domain: "runtime-security",
    tags: ["audit", "jq", "investigation"],
    front: "jq query that shows who tried to delete secrets and whether it worked",
    back: "Filter on verb delete with objectRef resource secrets, then print user.username, sourceIPs and responseCode. A responseCode of 403 means the attempt was denied rather than completed.",
    cmd: "jq -c 'select(.verb==\"delete\" and .objectRef.resource==\"secrets\") | {user: .user.username, ip: .sourceIPs, code: .responseCode}' /var/log/kubernetes/audit.log",
    why: "Denied attempts in the audit log are how you spot probing before a compromise succeeds."
  },
  {
    id: "c-084",
    domain: "runtime-security",
    tags: ["audit", "jq", "exec"],
    front: "Audit records of someone attaching to a running container, and the field that identifies them",
    back: "Look for verb create on pods with objectRef subresource exec or attach. The command content only appears if the matched rule level reaches Request or RequestResponse.",
    cmd: "jq -c 'select(.objectRef.subresource==\"exec\") | {user: .user.username, ns: .objectRef.namespace, name: .objectRef.name}' /var/log/kubernetes/audit.log",
    why: "A shell inside a pod is invisible in controller logs but obvious in the audit log."
  },
  {
    id: "c-085",
    domain: "runtime-security",
    tags: ["debug", "ephemeralcontainer", "kubectl"],
    front: "kubectl command that adds a debug container to a running pod without restarting it",
    back: "kubectl debug with an image and a target container creates an ephemeral container that shares the pod namespaces. It is not the application container, so it does not inherit the application security context. Confirm profiles with kubectl debug --help.",
    cmd: "kubectl debug -it APPPOD --image=busybox --target=main",
    why: "Ephemeral containers step around the immutability you built into the workload, so they need watching."
  },
  {
    id: "c-086",
    domain: "runtime-security",
    tags: ["debug", "node", "policygap"],
    front: "kubectl debug node command that gives you a host shell, and why it is a policy gap",
    back: "kubectl debug node NAME mounts the host filesystem, and chroot /host gives you a node shell through the API. Admission evaluates the debugger pod, but the real control is RBAC on the ephemeral containers subresource.",
    cmd: "kubectl debug node/NODENAME -it --image=busybox -- chroot /host",
    why: "Anyone who may create ephemeral containers can reach the node, which is effectively node level access."
  },
  {
    id: "c-087",
    domain: "runtime-security",
    tags: ["incident", "containment", "response"],
    front: "Order of actions when a running workload is confirmed compromised",
    back: "Contain first with a quarantine NetworkPolicy denying ingress and egress, scale the workload down or stop it, preserve the evidence, then replace the workload from a trusted image instead of repairing it in place.",
    cmd: "kubectl scale deployment suspect --replicas=0",
    why: "Deleting the pod first destroys the evidence and lets the controller recreate the same bad image."
  },
  {
    id: "c-088",
    domain: "runtime-security",
    tags: ["incident", "crictl", "evidence"],
    front: "Commands that preserve evidence from a compromised container before you delete the pod",
    back: "On the node use crictl to list containers, inspect the suspect container and capture its logs and configuration, and take process and filesystem state from the pod before anything is deleted or restarted.",
    cmd: "crictl inspect CONTAINER_ID",
    why: "Once the pod is gone the writable layer and the process state are usually unrecoverable."
  },
  {
    id: "c-089",
    domain: "runtime-security",
    tags: ["detection", "audit", "falco"],
    front: "Three runtime sources you correlate to answer what actually happened",
    back: "The audit log gives API actions by identity and source address, a syscall tracer such as Falco gives process and container behaviour, and Kubernetes events with controller logs give scheduling and lifecycle changes.",
    cmd: "kubectl get events -A --sort-by=.lastTimestamp",
    why: "Each source answers a different question, so trusting one of them gives you a confident wrong story."
  },
  {
    id: "c-090",
    domain: "runtime-security",
    tags: ["runtimeclass", "containerd", "sandbox"],
    front: "Why a Pod that names a RuntimeClass fails to start on a node",
    back: "The handler named by the RuntimeClass must exist in the container runtime configuration on that node, for example a runtime handler in the containerd CRI configuration. Confirm the configuration section name for your containerd version.",
    cmd: "kubectl get runtimeclass -o custom-columns=NAME:.metadata.name,HANDLER:.handler",
    why: "A handler no node runtime knows about is a permanently pending pod, not a security control."
  },
  {
    id: "c-091",
    domain: "runtime-security",
    tags: ["sandbox", "gvisor", "kata"],
    front: "When you choose gVisor, Kata Containers or a seccomp profile for isolation",
    back: "gVisor provides a user space kernel that intercepts syscalls with lower overhead than a virtual machine, Kata provides a lightweight virtual machine for the strongest workload separation, and seccomp filters syscalls inside the shared kernel as a cheap first layer.",
    cmd: "kubectl get runtimeclass",
    why: "These controls stack, so a RuntimeClass sandbox plus a seccomp profile is stronger than either alone."
  }
];
